import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
} from '../../generated/prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;

  const mockUserId = 'user-uuid-123';
  const mockOtherUserId = 'user-uuid-456';
  const mockSocialAccountId = 'account-uuid-123';
  const mockOtherSocialAccountId = 'account-uuid-456';
  const mockPostId = 'post-uuid-123';

  const mockSocialAccount = {
    id: mockSocialAccountId,
    platform: Platform.INSTAGRAM,
    platformAccountId: 'ig-123',
    username: 'test_creator',
    profileImageUrl: 'https://example.com/avatar.jpg',
    accessToken: 'encrypted_access_token',
    tokenExpiry: new Date('2026-12-31'),
    refreshToken: null,
    refreshTokenExpiry: null,
    connectionStatus: ConnectionStatus.CONNECTED,
    userId: mockUserId,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };

  const mockMedia = [
    {
      id: 'media-uuid-1',
      postId: mockPostId,
      mediaType: MediaType.IMAGE,
      fileName: 'photo1.jpg',
      filePath: 'uploads/photo1.jpg',
      fileSize: 1048576,
      mimeType: 'image/jpeg',
      sortOrder: 0,
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-01'),
    },
    {
      id: 'media-uuid-2',
      postId: mockPostId,
      mediaType: MediaType.IMAGE,
      fileName: 'photo2.jpg',
      filePath: 'uploads/photo2.jpg',
      fileSize: 2048576,
      mimeType: 'image/jpeg',
      sortOrder: 1,
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-01'),
    },
  ];

  const mockPost = {
    id: mockPostId,
    caption: 'Test post caption #OmniPost',
    status: PostStatus.DRAFT,
    cover: 'uploads/cover.jpg',
    publishedUrl: null,
    publishedAt: null,
    userId: mockUserId,
    socialAccountId: mockSocialAccountId,
    socialAccount: mockSocialAccount,
    media: mockMedia,
    createdAt: new Date('2026-08-16T10:00:00.000Z'),
    updatedAt: new Date('2026-08-16T10:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: PrismaService,
          useValue: {
            socialAccount: {
              findFirst: jest.fn(),
            },
            post: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            media: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn((callback) =>
              callback({
                post: {
                  create: jest.fn().mockResolvedValue(mockPost),
                  update: jest.fn().mockResolvedValue(mockPost),
                },
                media: {
                  deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
                  createMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
              }),
            ),
          },
        },
        {
          provide: SocialAccountsService,
          useValue: {
            sanitize: jest.fn((acc) => ({
              id: acc.id,
              platform: acc.platform,
              platformAccountId: acc.platformAccountId,
              username: acc.username,
              profileImageUrl: acc.profileImageUrl,
              tokenExpiry: acc.tokenExpiry,
              connectionStatus: acc.connectionStatus,
              createdAt: acc.createdAt,
              updatedAt: acc.updatedAt,
            })),
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    prisma = module.get<PrismaService>(PrismaService);
    socialAccountsService =
      module.get<SocialAccountsService>(SocialAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreatePostDto = {
      caption: 'Test post caption #OmniPost',
      socialAccountId: mockSocialAccountId,
      cover: 'uploads/cover.jpg',
      media: [
        {
          mediaType: MediaType.IMAGE,
          fileName: 'photo1.jpg',
          filePath: 'uploads/photo1.jpg',
          fileSize: 1048576,
          mimeType: 'image/jpeg',
          sortOrder: 0,
        },
      ],
    };

    it('should create post with own social account and media', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(
        mockSocialAccount,
      );

      const result = await service.create(mockUserId, createDto);

      expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockSocialAccountId,
          userId: mockUserId,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.id).toBe(mockPostId);
      expect(result.caption).toBe('Test post caption #OmniPost');
      expect(result.socialAccount.username).toBe('test_creator');
      expect(result.socialAccount).not.toHaveProperty('accessToken');
      expect(result.media).toHaveLength(2);
    });

    it('should reject creating post targeting foreign social account (NotFoundException)', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(mockUserId, {
          ...createDto,
          socialAccountId: mockOtherSocialAccountId,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllForUser', () => {
    it('should return paginated posts list strictly for authenticated user', async () => {
      (prisma.post.count as jest.Mock).mockResolvedValue(1);
      (prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost]);

      const result = await service.findAllForUser(mockUserId, {
        page: 1,
        limit: 10,
      });

      expect(prisma.post.count).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          socialAccount: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should filter by status when provided in query', async () => {
      (prisma.post.count as jest.Mock).mockResolvedValue(1);
      (prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost]);

      await service.findAllForUser(mockUserId, {
        page: 1,
        limit: 10,
        status: PostStatus.DRAFT,
      });

      expect(prisma.post.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: PostStatus.DRAFT },
      });
    });
  });

  describe('findOneForUser', () => {
    it('should return single post for owner', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.findOneForUser(mockPostId, mockUserId);

      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPostId,
          userId: mockUserId,
        },
        include: {
          socialAccount: true,
          media: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
      expect(result.id).toBe(mockPostId);
      expect(result.socialAccount.username).toBe('test_creator');
    });

    it('should reject retrieval of foreign post (NotFoundException)', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOneForUser(mockPostId, mockOtherUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateForUser', () => {
    const updateDto: UpdatePostDto = {
      caption: 'Updated caption',
    };

    it('should update post for owner', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.updateForUser(
        mockPostId,
        mockUserId,
        updateDto,
      );

      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPostId,
          userId: mockUserId,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.id).toBe(mockPostId);
    });

    it('should reject update if post belongs to another user (NotFoundException)', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateForUser(mockPostId, mockOtherUserId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject updating to target social account owned by another user', async () => {
      (prisma.post.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockPost) // Post found
        .mockResolvedValueOnce(null); // Foreign social account check returns null

      await expect(
        service.updateForUser(mockPostId, mockUserId, {
          socialAccountId: mockOtherSocialAccountId,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteForUser', () => {
    it('should delete post for owner', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.post.delete as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.deleteForUser(mockPostId, mockUserId);

      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPostId,
          userId: mockUserId,
        },
      });
      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: { id: mockPostId },
      });
      expect(result).toEqual({ message: 'Post deleted successfully' });
    });

    it('should reject deletion of foreign post (NotFoundException)', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteForUser(mockPostId, mockOtherUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
