import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { PostStatus } from '../../generated/prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginatedPostsResponseDto } from './dto/paginated-posts-response.dto';
import { MediaResponseDto } from './dto/media-response.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socialAccountsService: SocialAccountsService,
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
   * Updates media assets transactionally if specified.
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

    const updatedPost = await this.prisma.$transaction(async (tx) => {
      // If media array is provided in update, replace existing media records
      if (dto.media !== undefined) {
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

    return this.sanitizePost(updatedPost);
  }

  /**
   * Deletes a post belonging to the authenticated user.
   * Cascade deletes associated Media records in database.
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
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.post.delete({
      where: { id: existingPost.id },
    });

    return { message: 'Post deleted successfully' };
  }

  /**
   * Sanitizes post and nested relationships, guaranteeing no internal credentials or secrets leak.
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
