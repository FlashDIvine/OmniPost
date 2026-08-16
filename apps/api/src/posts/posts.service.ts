import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { StorageService } from '../storage/storage.service';
import {
  inspectContent,
  sanitizeFileName,
} from '../storage/utils/content-inspector';
import { Media, PostStatus } from '../../generated/prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginatedPostsResponseDto } from './dto/paginated-posts-response.dto';
import { MediaResponseDto } from './dto/media-response.dto';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Creates a new draft Post with optional media assets.
   * Atomically validates that the target SocialAccount belongs to the authenticated user.
   */
  async create(userId: string, dto: CreatePostDto): Promise<PostResponseDto> {
    // Strict application-level ownership verification for target SocialAccount
    const socialAccount = await this.prisma.socialAccount.findFirst({
      where: {
        id: dto.socialAccountId,
        userId,
      },
    });

    if (!socialAccount) {
      throw new NotFoundException('Social account not found');
    }

    // Atomic transaction creating Post and Media records
    const post = await this.prisma.$transaction(async (tx) => {
      return tx.post.create({
        data: {
          userId,
          socialAccountId: dto.socialAccountId,
          caption: dto.caption ?? null,
          cover: dto.cover ?? null,
          status: PostStatus.DRAFT,
          media:
            dto.media && dto.media.length > 0
              ? {
                  create: dto.media.map((m, idx) => ({
                    mediaType: m.mediaType,
                    fileName: m.fileName,
                    filePath: m.filePath,
                    fileSize: m.fileSize,
                    mimeType: m.mimeType,
                    sortOrder: m.sortOrder ?? idx,
                  })),
                }
              : undefined,
        },
        include: {
          socialAccount: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });

    return this.sanitizePost(post);
  }

  /**
   * Uploads a media file for an existing post belonging to the authenticated user.
   * Performs magic-byte inspection, stores the file safely, creates the Media record,
   * and rolls back storage on database failure.
   */
  async uploadMedia(
    postId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<MediaResponseDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A non-empty file is required for upload');
    }

    // Verify post ownership
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
      include: {
        media: {
          orderBy: { sortOrder: 'desc' },
          take: 1,
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Inspect content bytes and validate declared MIME type against signature
    const inspected = inspectContent(file.buffer, file.mimetype);
    const sanitizedName = sanitizeFileName(
      file.originalname,
      inspected.extension,
    );
    const nextSortOrder = (post.media[0]?.sortOrder ?? -1) + 1;

    // Generate collision-resistant storage key scoped by user and post
    const storageKey = this.storageService.generateKey(
      userId,
      postId,
      inspected.extension,
    );

    // 1. Upload file buffer to storage provider
    await this.storageService.upload(
      storageKey,
      file.buffer,
      inspected.mimeType,
    );

    // 2. Persist Media record to database with compensation rollback
    try {
      const media = await this.prisma.media.create({
        data: {
          postId,
          mediaType: inspected.mediaType,
          fileName: sanitizedName,
          filePath: storageKey,
          fileSize: file.size || file.buffer.length,
          mimeType: inspected.mimeType,
          sortOrder: nextSortOrder,
        },
      });

      return this.sanitizeMedia(media);
    } catch (dbError) {
      // Compensation: remove stored file to prevent orphaned physical assets
      this.logger.warn(
        `Database insert failed for media upload. Rolling back storage file: ${storageKey}`,
      );
      await this.storageService.delete(storageKey).catch((delErr) => {
        this.logger.error(
          `Failed to clean up storage file ${storageKey} during rollback: ${delErr.message}`,
        );
      });
      throw dbError;
    }
  }

  /**
   * Deletes a media asset from a post belonging to the authenticated user.
   * Deletes the physical file from storage and removes the database record.
   */
  async deleteMedia(
    postId: string,
    mediaId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        postId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Delete physical file from storage (idempotent)
    await this.storageService.delete(media.filePath).catch((err) => {
      this.logger.warn(
        `Failed to delete physical media file ${media.filePath}: ${err.message}`,
      );
    });

    // Delete database record
    await this.prisma.media.delete({
      where: { id: media.id },
    });

    return { message: 'Media deleted successfully' };
  }

  /**
   * Retrieves media buffer and metadata for authenticated viewing / streaming.
   */
  async getMediaStream(
    postId: string,
    mediaId: string,
    userId: string,
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    fileSize: number;
  }> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        postId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const buffer = await this.storageService.getBuffer(media.filePath);
    if (!buffer) {
      throw new NotFoundException('Media file not found in storage');
    }

    return {
      buffer,
      mimeType: media.mimeType,
      fileName: media.fileName,
      fileSize: media.fileSize,
    };
  }

  /**
   * Lists posts strictly belonging to the authenticated user with deterministic pagination and filtering.
   */
  async findAllForUser(
    userId: string,
    query: PostsQueryDto,
  ): Promise<PaginatedPostsResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [totalItems, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          socialAccount: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data: posts.map((p) => this.sanitizePost(p)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves a single post by ID strictly scoped to the authenticated user.
   */
  async findOneForUser(id: string, userId: string): Promise<PostResponseDto> {
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        socialAccount: true,
        media: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.sanitizePost(post);
  }

  /**
   * Updates an existing post belonging to the authenticated user.
   * Re-validates target SocialAccount ownership if changed.
   * Updates media assets transactionally and cleans up replaced physical files.
   */
  async updateForUser(
    id: string,
    userId: string,
    dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const existingPost = await this.prisma.post.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    // Validate new target SocialAccount ownership if updated
    if (
      dto.socialAccountId &&
      dto.socialAccountId !== existingPost.socialAccountId
    ) {
      const socialAccount = await this.prisma.socialAccount.findFirst({
        where: {
          id: dto.socialAccountId,
          userId,
        },
      });

      if (!socialAccount) {
        throw new NotFoundException('Social account not found');
      }
    }

    let oldMediaFilesToCleanup: string[] = [];

    const updatedPost = await this.prisma.$transaction(async (tx) => {
      // If media array is provided in update, replace existing media records
      if (dto.media !== undefined) {
        const oldMedia = await tx.media.findMany({
          where: { postId: id },
        });
        oldMediaFilesToCleanup = oldMedia.map((m) => m.filePath);

        await tx.media.deleteMany({
          where: { postId: id },
        });

        if (dto.media.length > 0) {
          await tx.media.createMany({
            data: dto.media.map((m, idx) => ({
              postId: id,
              mediaType: m.mediaType,
              fileName: m.fileName,
              filePath: m.filePath,
              fileSize: m.fileSize,
              mimeType: m.mimeType,
              sortOrder: m.sortOrder ?? idx,
            })),
          });
        }
      }

      return tx.post.update({
        where: { id },
        data: {
          ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
          ...(dto.cover !== undefined ? { cover: dto.cover } : {}),
          ...(dto.socialAccountId
            ? { socialAccountId: dto.socialAccountId }
            : {}),
        },
        include: {
          socialAccount: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });

    // Clean up replaced physical files after successful database commit
    for (const oldKey of oldMediaFilesToCleanup) {
      await this.storageService.delete(oldKey).catch(() => {});
    }

    return this.sanitizePost(updatedPost);
  }

  /**
   * Deletes a post belonging to the authenticated user.
   * Deletes associated physical media files and cascade deletes DB records.
   */
  async deleteForUser(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const existingPost = await this.prisma.post.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        media: true,
      },
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    const storageKeys = existingPost.media.map((m) => m.filePath);

    // Delete post in database (cascade deletes DB Media records)
    await this.prisma.post.delete({
      where: { id: existingPost.id },
    });

    // Clean up physical files from storage
    for (const key of storageKeys) {
      await this.storageService.delete(key).catch((err) => {
        this.logger.warn(
          `Failed to delete physical media file ${key} during post deletion: ${err.message}`,
        );
      });
    }

    return { message: 'Post deleted successfully' };
  }

  /**
   * Sanitizes media database record.
   */
  public sanitizeMedia(media: Media): MediaResponseDto {
    return {
      id: media.id,
      postId: media.postId,
      mediaType: media.mediaType,
      fileName: media.fileName,
      filePath: media.filePath,
      fileSize: media.fileSize,
      mimeType: media.mimeType,
      sortOrder: media.sortOrder,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }

  /**
   * Sanitizes post and nested relationships, guaranteeing no internal credentials or secrets leak.
   */
  private sanitizePost(post: any): PostResponseDto {
    const media: MediaResponseDto[] = (post.media || []).map((m: any) =>
      this.sanitizeMedia(m),
    );

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
