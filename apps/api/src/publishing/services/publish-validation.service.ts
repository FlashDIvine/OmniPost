import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PublisherRegistry } from '../registry/publisher.registry';
import {
  ConnectionStatus,
  Media,
  Post,
  PostStatus,
  SocialAccount,
} from '../../../generated/prisma/client';

export interface ValidatedPublishTarget {
  post: Post & { media: Media[] };
  socialAccount: SocialAccount;
}

@Injectable()
export class PublishValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly publisherRegistry: PublisherRegistry,
  ) {}

  /**
   * Validates all pre-conditions before publishing a post.
   * If any check fails, throws appropriate HTTP exception and ensures post status remains unchanged.
   */
  async validatePostForPublish(
    postId: string,
    userId: string,
    expectedStatus: PostStatus = PostStatus.DRAFT,
  ): Promise<ValidatedPublishTarget> {
    // 1. Fetch Post with media and target SocialAccount strictly scoped by user
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
      include: {
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        socialAccount: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 2. Validate current Post status
    if (post.status === PostStatus.PUBLISHED) {
      throw new ConflictException('Post has already been published');
    }

    if (post.status === PostStatus.PUBLISHING) {
      throw new ConflictException(
        'Post is currently in the process of publishing',
      );
    }

    if (post.status !== expectedStatus) {
      throw new ConflictException(
        `Post status is '${post.status}'. It must be '${expectedStatus}' to initiate publishing`,
      );
    }

    // 3. Validate target SocialAccount
    const socialAccount = post.socialAccount;
    if (!socialAccount || socialAccount.userId !== userId) {
      throw new NotFoundException('Target social account not found');
    }

    if (socialAccount.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new UnprocessableEntityException(
        `Target social account is not connected (current status: ${socialAccount.connectionStatus})`,
      );
    }

    // 4. Validate Media assets
    if (!post.media || post.media.length === 0) {
      throw new UnprocessableEntityException(
        'Cannot publish post without attached media assets',
      );
    }

    // 5. Verify physical media existence through StorageService abstraction
    for (const media of post.media) {
      const fileExists = await this.storageService.exists(media.filePath);
      if (!fileExists) {
        throw new UnprocessableEntityException(
          `Media file does not exist in storage: ${media.fileName}`,
        );
      }
    }

    // 6. Verify platform publisher adapter is registered
    this.publisherRegistry.get(socialAccount.platform);

    return {
      post,
      socialAccount,
    };
  }
}
