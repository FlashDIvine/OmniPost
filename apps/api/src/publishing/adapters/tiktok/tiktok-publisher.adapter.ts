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
import {
  TikTokApiClient,
  TikTokPublishStatusResponse,
} from './tiktok-api.client';
import { StorageService } from '../../../storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TikTokPublisherAdapter implements PublisherAdapter {
  readonly platform = Platform.TIKTOK;
  private readonly logger = new Logger(TikTokPublisherAdapter.name);

  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(
    private readonly apiClient: TikTokApiClient,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.pollIntervalMs = parseInt(
      this.configService.get<string>('TIKTOK_MEDIA_POLL_INTERVAL_MS') || '2000',
      10,
    );
    this.maxPollAttempts = parseInt(
      this.configService.get<string>('TIKTOK_MEDIA_POLL_MAX_ATTEMPTS') || '30',
      10,
    );
  }

  /**
   * Validates TikTok-specific publishing rules and media constraints.
   * Throws UnprocessableEntityException for content, format, or constraint violations.
   */
  async validateContent(context: PublishContext): Promise<void> {
    const { post, socialAccount } = context;

    // 1. Validate target platform and account connection status
    if (socialAccount.platform !== Platform.TIKTOK) {
      throw new UnprocessableEntityException(
        `Invalid platform for TikTok publisher: ${socialAccount.platform}`,
      );
    }

    if (socialAccount.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new UnprocessableEntityException(
        `Target TikTok account is not in CONNECTED status (current: ${socialAccount.connectionStatus})`,
      );
    }

    // 2. Validate media presence
    const media = post.media || [];
    if (media.length === 0) {
      throw new UnprocessableEntityException(
        'TikTok publishing requires at least 1 media asset',
      );
    }

    const videos = media.filter((m) => m.mediaType === MediaType.VIDEO);
    const images = media.filter((m) => m.mediaType === MediaType.IMAGE);

    // 3. Reject mixed media configurations
    if (videos.length > 0 && images.length > 0) {
      throw new UnprocessableEntityException(
        'TikTok does not support mixed video and photo posts in a single publish',
      );
    }

    // 4. Validate Video publishing rules
    if (videos.length > 0) {
      if (videos.length !== 1) {
        throw new UnprocessableEntityException(
          `TikTok video publishing allows only exactly 1 video. Post has ${videos.length}`,
        );
      }

      const validVideoMimes = [
        'video/mp4',
        'video/quicktime',
        'video/webm',
      ];
      const videoMime = videos[0].mimeType?.toLowerCase();
      if (!validVideoMimes.includes(videoMime)) {
        throw new UnprocessableEntityException(
          `Unsupported video format for TikTok: ${videos[0].mimeType}. Supported formats: MP4, MOV, WEBM`,
        );
      }
    }

    // 5. Validate Photo publishing rules (1-35 images, JPEG or WEBP only)
    if (images.length > 0) {
      if (images.length < 1 || images.length > 35) {
        throw new UnprocessableEntityException(
          `TikTok photo publishing requires between 1 and 35 images. Post has ${images.length}`,
        );
      }

      const validPhotoMimes = ['image/jpeg', 'image/jpg', 'image/webp'];
      for (const img of images) {
        const photoMime = img.mimeType?.toLowerCase();
        if (!validPhotoMimes.includes(photoMime)) {
          throw new UnprocessableEntityException(
            `Unsupported photo format for TikTok: ${img.mimeType}. Only JPEG and WEBP are supported. PNG and other formats are rejected.`,
          );
        }
      }
    }

    // 6. Validate caption length constraints (TikTok limit: 2200 characters)
    if (post.caption && post.caption.length > 2200) {
      throw new UnprocessableEntityException(
        `Caption exceeds TikTok maximum limit of 2200 characters (length: ${post.caption.length})`,
      );
    }

    // 7. Validate media URL reachability / format
    for (const m of media) {
      const externalUrl = this.storageService.getExternalUrl(m.filePath);
      if (
        !externalUrl ||
        (!externalUrl.startsWith('http://') &&
          !externalUrl.startsWith('https://'))
      ) {
        throw new UnprocessableEntityException(
          `Invalid external media URL generated for media ${m.id}: ${externalUrl}`,
        );
      }
    }
  }

  /**
   * Publishes content to TikTok using Content Posting API v2 Direct Post.
   */
  async publish(context: PublishContext): Promise<PublishResult> {
    const { post, socialAccount, accessToken } = context;
    const media = [...post.media].sort((a, b) => a.sortOrder - b.sortOrder);
    const isVideo = media[0].mediaType === MediaType.VIDEO;

    this.logger.log(
      `Starting TikTok publishing for Post ${post.id} (${media.length} ${isVideo ? 'video' : 'photo(s)'}) to TikTok account ${socialAccount.username || socialAccount.platformAccountId}`,
    );

    try {
      // 1. Query creator info to obtain supported privacy levels and interaction flags
      const creatorInfo = await this.apiClient.queryCreatorInfo(accessToken);

      // 2. Select supported privacy level (prefer PUBLIC_TO_EVERYONE if allowed)
      let privacyLevel: string;
      const privacyOptions = creatorInfo.privacy_level_options || [];

      if (privacyOptions.includes('PUBLIC_TO_EVERYONE')) {
        privacyLevel = 'PUBLIC_TO_EVERYONE';
      } else if (privacyOptions.length > 0) {
        privacyLevel = privacyOptions[0];
      } else {
        throw new UnprocessableEntityException(
          'TikTok creator account did not return any supported privacy levels',
        );
      }

      let publishId: string;

      // 3. Initialize Direct Post depending on media type
      if (isVideo) {
        const videoUrl = this.storageService.getExternalUrl(media[0].filePath);
        const initRes = await this.apiClient.initVideoPublish(accessToken, {
          post_info: {
            title: post.caption ?? undefined,
            privacy_level: privacyLevel,
            disable_comment: creatorInfo.comment_disabled === true,
            disable_duet: creatorInfo.duet_disabled === true,
            disable_stitch: creatorInfo.stitch_disabled === true,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        });
        publishId = initRes.publish_id;
      } else {
        const photoUrls = media.map((m) =>
          this.storageService.getExternalUrl(m.filePath),
        );
        const initRes = await this.apiClient.initPhotoPublish(accessToken, {
          media_type: 'PHOTO',
          post_mode: 'DIRECT_POST',
          post_info: {
            title: post.caption ?? undefined,
            privacy_level: privacyLevel,
            disable_comment: creatorInfo.comment_disabled === true,
            auto_add_music: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            photo_cover_index: 1,
            photo_images: photoUrls,
          },
        });
        publishId = initRes.publish_id;
      }

      // 4. Poll publish status until PUBLISH_COMPLETE
      const statusRes = await this.pollPublishStatus(publishId, accessToken);

      // 5. Construct public URL safely from username and returned post ID
      const postId =
        statusRes.public_post_id ||
        (statusRes.public_post_ids && statusRes.public_post_ids[0]);

      let publishedUrl: string | undefined;
      if (socialAccount.username && postId) {
        const pathType = isVideo ? 'video' : 'photo';
        publishedUrl = `https://www.tiktok.com/@${socialAccount.username}/${pathType}/${postId}`;
      }

      this.logger.log(
        `TikTok post successfully published: ${postId || publishId} (URL: ${publishedUrl || 'N/A'})`,
      );

      return {
        success: true,
        publishedUrl,
        platformPostId: postId || publishId,
      };
    } catch (err: any) {
      const publishError: PublishError =
        err.classification && err.message
          ? err
          : this.apiClient.normalizeError(err);

      this.logger.error(
        `TikTok publish failed for Post ${post.id}: ${publishError.message} (Code: ${publishError.apiErrorCode})`,
      );

      // If token expired / revoked / invalid, update social account status to EXPIRED
      if (
        publishError.apiErrorCode === 'access_token_invalid' ||
        publishError.apiErrorCode === 'token_expired' ||
        publishError.apiErrorCode === 'invalid_token' ||
        publishError.apiErrorCode === 'invalid_grant' ||
        publishError.apiErrorCode === '40101' ||
        publishError.apiErrorCode === '40102' ||
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
   * Polls TikTok publish status endpoint until PUBLISH_COMPLETE, FAILED, or timeout.
   */
  private async pollPublishStatus(
    publishId: string,
    accessToken: string,
  ): Promise<TikTokPublishStatusResponse> {
    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt++) {
      const statusRes = await this.apiClient.fetchPublishStatus(
        accessToken,
        publishId,
      );

      if (statusRes.status === 'PUBLISH_COMPLETE') {
        return statusRes;
      }

      if (statusRes.status === 'FAILED') {
        const failMessage =
          statusRes.fail_reason ||
          'TikTok publishing failed during server processing';
        const failError: PublishError = {
          message: failMessage,
          apiErrorCode: 'TIKTOK_PUBLISH_FAILED',
          classification: 'PERMANENT',
        };
        throw failError;
      }

      // If still processing (PROCESSING_DOWNLOAD or PROCESSING_UPLOAD), wait before next poll
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    // Polling attempts exhausted
    const timeoutError: PublishError = {
      message: `TikTok media processing timed out after ${this.maxPollAttempts * this.pollIntervalMs}ms. Publish ID ${publishId} is still in progress.`,
      apiErrorCode: 'TIKTOK_POLL_TIMEOUT',
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
        `Updated TikTok SocialAccount ${socialAccountId} connectionStatus to EXPIRED`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to update TikTok SocialAccount ${socialAccountId} status: ${err.message}`,
      );
    }
  }
}
