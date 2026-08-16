import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { StorageService } from '../storage/storage.service';
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
  let storageService: StorageService;

  const mockUserId = 'user-uuid-123';
  const mockOtherUserId = 'user-uuid-456';
  const mockSocialAccountId = 'account-uuid-123';
  const mockOtherSocialAccountId = 'account-uuid-456';
  const mockPostId = 'post-uuid-123';
  const mockMediaId = 'media-uuid-1';

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

  const mockMediaItem = {
    id: mockMediaId,
    postId: mockPostId,
    mediaType: MediaType.IMAGE,
    fileName: 'photo1.jpg',
    filePath: `users/${mockUserId}/posts/${mockPostId}/photo1.jpg`,
    fileSize: 1048576,
    mimeType: 'image/jpeg',
    sortOrder: 0,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };

  const mockMedia = [
    mockMediaItem,
    {
      id: 'media-uuid-2',
      postId: mockPostId,
      mediaType: MediaType.IMAGE,
      fileName: 'photo2.jpg',
      filePath: `users/${mockUserId}/posts/${mockPostId}/photo2.jpg`,
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

  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48,
  ]);

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
              create: jest.fn(),
              createMany: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) =>
              callback({
                post: {
                  create: jest.fn().mockResolvedValue(mockPost),
                  update: jest.fn().mockResolvedValue(mockPost),
                },
                media: {
                  findMany: jest.fn().mockResolvedValue(mockMedia),
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
        {
          provide: StorageService,
          useValue: {
            generateKey: jest.fn(
              (userId, postId, ext) =>
                `users/${userId}/posts/${postId}/generated-key.${ext}`,
            ),
            upload: jest.fn().mockResolvedValue('uploaded-key'),
            delete: jest.fn().mockResolvedValue(true),
            exists: jest.fn().mockResolvedValue(true),
            getBuffer: jest.fn().mockResolvedValue(validJpegBuffer),
            getPublicUrl: jest.fn((k) => `/media/${k}`),
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    prisma = module.get<PrismaService>(PrismaService);
    socialAccountsService =
      module.get<SocialAccountsService>(SocialAccountsService);
    storageService = module.get<StorageService>(StorageService);
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

  describe('uploadMedia', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'vacation_photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: validJpegBuffer.length,
      buffer: validJpegBuffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('should upload media for owned post and create database record', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.media.create as jest.Mock).mockResolvedValue(mockMediaItem);

      const result = await service.uploadMedia(
        mockPostId,
        mockUserId,
        mockFile,
      );

      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: { id: mockPostId, userId: mockUserId },
        include: {
          media: {
            orderBy: { sortOrder: 'desc' },
            take: 1,
          },
        },
      });
      expect(storageService.upload).toHaveBeenCalled();
      expect(prisma.media.create).toHaveBeenCalled();
      expect(result.id).toBe(mockMediaId);
      expect(result.mediaType).toBe(MediaType.IMAGE);
    });

    it('should reject media upload if post belongs to another user (NotFoundException)', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.uploadMedia(mockPostId, mockOtherUserId, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject media upload if file is missing or empty buffer', async () => {
      await expect(
        service.uploadMedia(mockPostId, mockUserId, null as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadMedia(mockPostId, mockUserId, {
          ...mockFile,
          buffer: Buffer.alloc(0),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger storage file cleanup if DB create fails (compensation)', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.media.create as jest.Mock).mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.uploadMedia(mockPostId, mockUserId, mockFile),
      ).rejects.toThrow('Database connection failed');

      expect(storageService.delete).toHaveBeenCalledWith(
        `users/${mockUserId}/posts/${mockPostId}/generated-key.jpg`,
      );
    });
  });

  describe('deleteMedia', () => {
    it('should delete media and remove physical file from storage', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMediaItem);
      (prisma.media.delete as jest.Mock).mockResolvedValue(mockMediaItem);

      const result = await service.deleteMedia(
        mockPostId,
        mockMediaId,
        mockUserId,
      );

      expect(storageService.delete).toHaveBeenCalledWith(mockMediaItem.filePath);
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: mockMediaId },
      });
      expect(result).toEqual({ message: 'Media deleted successfully' });
    });

    it('should reject delete if post belongs to another user', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteMedia(mockPostId, mockMediaId, mockOtherUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject delete if media does not belong to post', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteMedia(mockPostId, 'non-existent-media', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMediaStream', () => {
    it('should return media buffer for owner', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMediaItem);

      const result = await service.getMediaStream(
        mockPostId,
        mockMediaId,
        mockUserId,
      );

      expect(result.buffer).toEqual(validJpegBuffer);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.fileName).toBe('photo1.jpg');
    });

    it('should reject retrieval if post belongs to another user', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getMediaStream(mockPostId, mockMediaId, mockOtherUserId),
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
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('findOneForUser', () => {
    it('should return single post for owner', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.findOneForUser(mockPostId, mockUserId);
      expect(result.id).toBe(mockPostId);
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

      expect(result.id).toBe(mockPostId);
    });

    it('should reject update if post belongs to another user (NotFoundException)', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateForUser(mockPostId, mockOtherUserId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteForUser', () => {
    it('should delete post for owner and clean up physical storage files', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockPost);
      (prisma.post.delete as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.deleteForUser(mockPostId, mockUserId);

      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: { id: mockPostId },
      });
      expect(storageService.delete).toHaveBeenCalledTimes(2);
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
