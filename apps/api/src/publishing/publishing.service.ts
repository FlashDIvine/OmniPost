import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { PublishValidationService } from './services/publish-validation.service';
import { PublisherRegistry } from './registry/publisher.registry';
import {
  PostStatus,
  PublishAttempt,
  PublishAttemptStatus,
} from '../../generated/prisma/client';
import { PublishResponseDto } from './dto/publish-response.dto';
import { PublishAttemptResponseDto } from './dto/publish-attempt-response.dto';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { MediaResponseDto } from '../posts/dto/media-response.dto';
import { PublishResult } from './types/publish-result.type';

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly publishValidationService: PublishValidationService,
    private readonly publisherRegistry: PublisherRegistry,
  ) {}

  /**
   * Publishes a draft post to the target social platform.
   * Atomically claims publishing state, tracks attempt, and coordinates execution.
   */
  async publishPost(
    postId: string,
    userId: string,
  ): Promise<PublishResponseDto> {
    return this.executePublishPipeline(postId, userId, PostStatus.DRAFT);
  }

  /**
   * Retries publishing for a post in FAILED status.
   * Atomically claims FAILED -> PUBLISHING, creates a new PublishAttempt record,
   * and preserves previous attempt history.
   */
  async retryPublish(
    postId: string,
    userId: string,
  ): Promise<PublishResponseDto> {
    return this.executePublishPipeline(postId, userId, PostStatus.FAILED);
  }

  /**
   * Retrieves all historical publish attempts for a post owned by the authenticated user.
   */
  async getPublishAttemptsForPost(
    postId: string,
    userId: string,
  ): Promise<PublishAttemptResponseDto[]> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const attempts = await this.prisma.publishAttempt.findMany({
      where: { postId },
      orderBy: { startedAt: 'desc' },
    });

    return attempts.map((a) => this.sanitizeAttempt(a));
  }

  /**
   * Core publishing pipeline engine coordinating preflight validation, atomic claim,
   * out-of-transaction adapter execution, and safe finalization.
   */
  private async executePublishPipeline(
    postId: string,
    userId: string,
    expectedInitialStatus: PostStatus,
  ): Promise<PublishResponseDto> {
    // 1. Preflight validation (preconditions, physical files, account status)
    const { post, socialAccount } =
      await this.publishValidationService.validatePostForPublish(
        postId,
        userId,
        expectedInitialStatus,
      );

    // 2. Database-backed atomic claim to prevent concurrent duplicate publishing
    const claimResult = await this.prisma.post.updateMany({
      where: {
        id: postId,
        userId,
        status: expectedInitialStatus,
      },
      data: {
        status: PostStatus.PUBLISHING,
      },
    });

    if (claimResult.count === 0) {
      this.logger.warn(
        `Concurrency collision: Post ${postId} is already in state PUBLISHING or status changed`,
      );
      throw new ConflictException(
        `Post cannot be published from its current status (must be ${expectedInitialStatus})`,
      );
    }

    // 3. Create a new PublishAttempt record in PENDING status
    const attempt = await this.prisma.publishAttempt.create({
      data: {
        postId,
        status: PublishAttemptStatus.PENDING,
        startedAt: new Date(),
      },
    });

    this.logger.log(
      `Publishing started for Post ${postId} on platform ${socialAccount.platform} (Attempt: ${attempt.id})`,
    );

    // 4. Resolve adapter and execute external publishing outside DB transaction
    let publishResult: PublishResult;

    try {
      const decryptedAccessToken =
        await this.socialAccountsService.getDecryptedAccessToken(
          socialAccount.id,
          userId,
        );

      const adapter = this.publisherRegistry.get(socialAccount.platform);

      const publishContext = {
        post,
        socialAccount,
        accessToken: decryptedAccessToken,
      };

      await adapter.validateContent(publishContext);
      publishResult = await adapter.publish(publishContext);
    } catch (err: any) {
      publishResult = {
        success: false,
        error: {
          message: err.message || 'Unexpected error during publishing execution',
          apiErrorCode: err.apiErrorCode || 'UNEXPECTED_ERROR',
          classification: 'PERMANENT',
          rawError: err,
        },
      };
    }

    // 5. Finalize Post and PublishAttempt atomically
    const now = new Date();

    if (publishResult.success) {
      const [updatedPost, updatedAttempt] = await this.prisma.$transaction([
        this.prisma.post.update({
          where: { id: postId },
          data: {
            status: PostStatus.PUBLISHED,
            publishedUrl: publishResult.publishedUrl || null,
            publishedAt: now,
          },
          include: {
            socialAccount: true,
            media: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        }),
        this.prisma.publishAttempt.update({
          where: { id: attempt.id },
          data: {
            status: PublishAttemptStatus.SUCCESS,
            finishedAt: now,
            errorMessage: null,
            apiErrorCode: null,
          },
        }),
      ]);

      this.logger.log(
        `Publishing succeeded for Post ${postId} (Attempt: ${attempt.id})`,
      );

      return {
        post: this.sanitizePost(updatedPost),
        attempt: this.sanitizeAttempt(updatedAttempt),
      };
    } else {
      const sanitizedError = this.sanitizeErrorMessage(
        publishResult.error?.message || 'Publishing failed on platform',
      );

      const [updatedPost, updatedAttempt] = await this.prisma.$transaction([
        this.prisma.post.update({
          where: { id: postId },
          data: {
            status: PostStatus.FAILED,
          },
          include: {
            socialAccount: true,
            media: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        }),
        this.prisma.publishAttempt.update({
          where: { id: attempt.id },
          data: {
            status: PublishAttemptStatus.FAILED,
            finishedAt: now,
            errorMessage: sanitizedError,
            apiErrorCode: publishResult.error?.apiErrorCode || null,
          },
        }),
      ]);

      this.logger.warn(
        `Publishing failed for Post ${postId} (Attempt: ${attempt.id}, Classification: ${publishResult.error?.classification}): ${sanitizedError}`,
      );

      return {
        post: this.sanitizePost(updatedPost),
        attempt: this.sanitizeAttempt(updatedAttempt),
      };
    }
  }

  /**
   * Sanitizes error message to guarantee tokens or secrets never leak into DB or API response.
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message) return 'Unknown publishing failure';
    return message
      .replace(/EAAG[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/act\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer [REDACTED]')
      .slice(0, 1000);
  }

  /**
   * Sanitizes publish attempt entity for API response.
   */
  public sanitizeAttempt(attempt: PublishAttempt): PublishAttemptResponseDto {
    return {
      id: attempt.id,
      postId: attempt.postId,
      status: attempt.status,
      errorMessage: attempt.errorMessage,
      apiErrorCode: attempt.apiErrorCode,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
    };
  }

  /**
   * Sanitizes post and relations for API response.
   */
  private sanitizePost(post: any): PostResponseDto {
    const media: MediaResponseDto[] = (post.media || []).map((m: any) => ({
      id: m.id,
      postId: m.postId,
      mediaType: m.mediaType,
      fileName: m.fileName,
      filePath: m.filePath,
      fileSize: m.fileSize,
      mimeType: m.mimeType,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return {
      id: post.id,
      caption: post.caption,
      status: post.status,
      cover: post.cover,
      publishedUrl: post.publishedUrl,
      publishedAt: post.publishedAt,
      socialAccountId: post.socialAccountId,
      socialAccount: this.socialAccountsService.sanitize(post.socialAccount),
      media,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
