import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectionStatus,
  MediaType,
  Platform,
} from '../../../../generated/prisma/client';
import {
  PublishContext,
  PublisherAdapter,
} from '../publisher-adapter.interface';
import { PublishResult } from '../../types/publish-result.type';
import { PublishError } from '../../types/publish-error.type';
import { InstagramApiClient } from './instagram-api.client';
import { StorageService } from '../../../storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class InstagramPublisherAdapter implements PublisherAdapter {
  readonly platform = Platform.INSTAGRAM;
  private readonly logger = new Logger(InstagramPublisherAdapter.name);

  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(
    private readonly apiClient: InstagramApiClient,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.pollIntervalMs = parseInt(
      this.configService.get<string>('INSTAGRAM_MEDIA_POLL_INTERVAL_MS') ||
        '2000',
      10,
    );
    this.maxPollAttempts = parseInt(
      this.configService.get<string>('INSTAGRAM_MEDIA_POLL_MAX_ATTEMPTS') ||
        '30',
      10,
    );
  }

  /**
   * Validates Instagram-specific publishing rules and constraints.
   * Throws UnprocessableEntityException for permanent content or format violations.
   */
  async validateContent(context: PublishContext): Promise<void> {
    const { post, socialAccount } = context;

    // 1. Validate target platform and account connection status
    if (socialAccount.platform !== Platform.INSTAGRAM) {
      throw new UnprocessableEntityException(
        `Invalid platform for Instagram publisher: ${socialAccount.platform}`,
      );
    }

    if (socialAccount.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new UnprocessableEntityException(
        `Target Instagram account is not in CONNECTED status (current: ${socialAccount.connectionStatus})`,
      );
    }

    // 2. Validate media presence and count
    const media = post.media || [];
    if (media.length === 0) {
      throw new UnprocessableEntityException(
        'Instagram publishing requires at least 1 media asset',
      );
    }

    if (media.length > 10) {
      throw new UnprocessableEntityException(
        `Instagram carousel allows a maximum of 10 media items. Post has ${media.length}`,
      );
    }

    // 3. Validate caption constraints (Meta limit: 2200 characters, max 30 hashtags)
    if (post.caption) {
      if (post.caption.length > 2200) {
        throw new UnprocessableEntityException(
          `Caption exceeds Instagram maximum limit of 2200 characters (length: ${post.caption.length})`,
        );
      }

      const hashtagMatches = post.caption.match(/#[^\s#]+/g);
      if (hashtagMatches && hashtagMatches.length > 30) {
        throw new UnprocessableEntityException(
          `Caption exceeds Instagram maximum limit of 30 hashtags (count: ${hashtagMatches.length})`,
        );
      }
    }

    // 4. Validate media accessibility (ensure valid URL format)
    for (const m of media) {
      const externalUrl = this.storageService.getExternalUrl(m.filePath);
      if (!externalUrl || (!externalUrl.startsWith('http://') && !externalUrl.startsWith('https://'))) {
        throw new UnprocessableEntityException(
          `Invalid external media URL generated for media ${m.id}: ${externalUrl}`,
        );
      }
    }
  }

  /**
   * Publishes content to Instagram using the official container-based Graph API.
   */
  async publish(context: PublishContext): Promise<PublishResult> {
    const { post, socialAccount, accessToken } = context;
    const igUserId = socialAccount.platformAccountId;
    const media = [...post.media].sort((a, b) => a.sortOrder - b.sortOrder);

    this.logger.log(
      `Starting Instagram publishing for Post ${post.id} (${media.length} media item(s)) to IG User ${igUserId}`,
    );

    try {
      let publishedMediaId: string;

      // 1. Single Image Post
      if (media.length === 1 && media[0].mediaType === MediaType.IMAGE) {
        publishedMediaId = await this.publishSingleImage(
          igUserId,
          accessToken,
          media[0].filePath,
          post.caption ?? undefined,
        );
      }

      // 2. Single Video / Reels Post
      else if (media.length === 1 && media[0].mediaType === MediaType.VIDEO) {
        publishedMediaId = await this.publishSingleVideo(
          igUserId,
          accessToken,
          media[0].filePath,
          post.caption ?? undefined,
          post.cover ? this.storageService.getExternalUrl(post.cover) : undefined,
        );
      }

      // 3. Carousel Album (2..10 mixed images and videos)
      else if (media.length >= 2 && media.length <= 10) {
        publishedMediaId = await this.publishCarousel(
          igUserId,
          accessToken,
          media,
          post.caption ?? undefined,
        );
      } else {
        throw new UnprocessableEntityException(
          `Unsupported media configuration for Instagram (count: ${media.length})`,
        );
      }

      // 4. Retrieve published post details (permalink)
      let publishedUrl: string | undefined;
      try {
        const details = await this.apiClient.getMediaDetails(
          publishedMediaId,
          accessToken,
        );
        publishedUrl = details.permalink;
      } catch (detailsErr: any) {
        this.logger.warn(
          `Could not fetch permalink for published Instagram post ${publishedMediaId}: ${detailsErr.message}`,
        );
        publishedUrl = `https://www.instagram.com/p/${publishedMediaId}`;
      }

      this.logger.log(
        `Instagram post successfully published: ${publishedMediaId} (URL: ${publishedUrl})`,
      );

      return {
        success: true,
        publishedUrl,
        platformPostId: publishedMediaId,
      };
    } catch (err: any) {
      const publishError: PublishError =
        err.classification && err.message
          ? err
          : this.apiClient.normalizeError(err);

      this.logger.error(
        `Instagram publish failed for Post ${post.id}: ${publishError.message} (Code: ${publishError.apiErrorCode})`,
      );

      // If token expired / revoked, update social account status in DB
      if (
        publishError.apiErrorCode?.startsWith('190') ||
        publishError.message.toLowerCase().includes('token')
      ) {
        await this.handleExpiredAccount(socialAccount.id);
      }

      return {
        success: false,
        error: publishError,
      };
    }
  }

  /**
   * Publishes a single image post.
   */
  private async publishSingleImage(
    igUserId: string,
    accessToken: string,
    storageKey: string,
    caption?: string,
  ): Promise<string> {
    const imageUrl = this.storageService.getExternalUrl(storageKey);
    const container = await this.apiClient.createImageContainer(
      igUserId,
      accessToken,
      {
        imageUrl,
        caption,
      },
    );

    await this.pollContainerUntilReady(container.id, accessToken);
    const published = await this.apiClient.publishContainer(
      igUserId,
      accessToken,
      container.id,
    );

    return published.id;
  }

  /**
   * Publishes a single video / Reels post.
   */
  private async publishSingleVideo(
    igUserId: string,
    accessToken: string,
    storageKey: string,
    caption?: string,
    coverUrl?: string,
  ): Promise<string> {
    const videoUrl = this.storageService.getExternalUrl(storageKey);
    const container = await this.apiClient.createVideoContainer(
      igUserId,
      accessToken,
      {
        videoUrl,
        caption,
        coverUrl,
      },
    );

    await this.pollContainerUntilReady(container.id, accessToken);
    const published = await this.apiClient.publishContainer(
      igUserId,
      accessToken,
      container.id,
    );

    return published.id;
  }

  /**
   * Publishes a multi-item Carousel Album.
   */
  private async publishCarousel(
    igUserId: string,
    accessToken: string,
    media: Array<{ filePath: string; mediaType: MediaType }>,
    caption?: string,
  ): Promise<string> {
    // 1. Create child item containers in parallel
    const childContainerIds: string[] = [];

    for (const m of media) {
      const url = this.storageService.getExternalUrl(m.filePath);
      if (m.mediaType === MediaType.IMAGE) {
        const child = await this.apiClient.createImageContainer(
          igUserId,
          accessToken,
          {
            imageUrl: url,
            isCarouselItem: true,
          },
        );
        childContainerIds.push(child.id);
      } else {
        const child = await this.apiClient.createVideoContainer(
          igUserId,
          accessToken,
          {
            videoUrl: url,
            isCarouselItem: true,
          },
        );
        childContainerIds.push(child.id);
      }
    }

    // 2. Poll all child containers until processing finishes
    for (const childId of childContainerIds) {
      await this.pollContainerUntilReady(childId, accessToken);
    }

    // 3. Create parent carousel container referencing child containers
    const parentContainer = await this.apiClient.createCarouselContainer(
      igUserId,
      accessToken,
      {
        children: childContainerIds,
        caption,
      },
    );

    // 4. Poll parent container until ready
    await this.pollContainerUntilReady(parentContainer.id, accessToken);

    // 5. Publish parent container
    const published = await this.apiClient.publishContainer(
      igUserId,
      accessToken,
      parentContainer.id,
    );

    return published.id;
  }

  /**
   * Polls an Instagram media container until its status becomes FINISHED or fails.
   */
  private async pollContainerUntilReady(
    containerId: string,
    accessToken: string,
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt++) {
      const status = await this.apiClient.getContainerStatus(
        containerId,
        accessToken,
      );

      if (status.statusCode === 'FINISHED' || status.statusCode === 'PUBLISHED') {
        return;
      }

      if (status.statusCode === 'ERROR') {
        throw this.apiClient.normalizeError(
          new Error(`Instagram media container ${containerId} processing failed with status ERROR`),
        );
      }

      if (status.statusCode === 'EXPIRED') {
        throw this.apiClient.normalizeError(
          new Error(`Instagram media container ${containerId} has expired`),
        );
      }

      // If IN_PROGRESS, sleep before next attempt
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    // If polling timed out
    const timeoutError: PublishError = {
      message: `Instagram media processing timed out after ${this.maxPollAttempts * this.pollIntervalMs}ms. Container ${containerId} is still in progress.`,
      apiErrorCode: 'CONTAINER_POLL_TIMEOUT',
      classification: 'RETRYABLE',
    };
    throw timeoutError;
  }

  /**
   * Updates social account connection status to EXPIRED in database when tokens fail.
   */
  private async handleExpiredAccount(socialAccountId: string): Promise<void> {
    try {
      await this.prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: { connectionStatus: ConnectionStatus.EXPIRED },
      });
      this.logger.warn(
        `Updated SocialAccount ${socialAccountId} connectionStatus to EXPIRED`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to update SocialAccount ${socialAccountId} status: ${err.message}`,
      );
    }
  }
}
