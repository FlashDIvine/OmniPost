import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PublishValidationService } from './publish-validation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PublisherRegistry } from '../registry/publisher.registry';
import { MockPublisherAdapter } from '../adapters/mock-publisher.adapter';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
} from '../../../generated/prisma/client';

describe('PublishValidationService', () => {
  let service: PublishValidationService;
  let prisma: PrismaService;
  let storageService: StorageService;
  let registry: PublisherRegistry;

  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';
  const mockPostId = 'post-123';

  const mockSocialAccount = {
    id: 'account-123',
    platform: Platform.INSTAGRAM,
    platformAccountId: 'ig-123',
    username: 'test_creator',
    profileImageUrl: null,
    accessToken: 'encrypted_token',
    tokenExpiry: null,
    refreshToken: null,
    refreshTokenExpiry: null,
    connectionStatus: ConnectionStatus.CONNECTED,
    userId: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMedia = [
    {
      id: 'media-123',
      postId: mockPostId,
      mediaType: MediaType.IMAGE,
      fileName: 'photo.jpg',
      filePath: 'users/user-123/posts/post-123/img.jpg',
      fileSize: 1048576,
      mimeType: 'image/jpeg',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockValidPost = {
    id: mockPostId,
    caption: 'Valid draft caption',
    status: PostStatus.DRAFT,
    cover: null,
    publishedUrl: null,
    publishedAt: null,
    userId: mockUserId,
    socialAccountId: 'account-123',
    socialAccount: mockSocialAccount,
    media: mockMedia,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAdapter = new MockPublisherAdapter(Platform.INSTAGRAM);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishValidationService,
        {
          provide: PrismaService,
          useValue: {
            post: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            exists: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PublisherRegistry,
          useValue: {
            get: jest.fn().mockReturnValue(mockAdapter),
          },
        },
      ],
    }).compile();

    service = module.get<PublishValidationService>(PublishValidationService);
    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get<StorageService>(StorageService);
    registry = module.get<PublisherRegistry>(PublisherRegistry);
  });

  it('should pass validation for a valid draft post with media and connected account', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockValidPost);

    const result = await service.validatePostForPublish(
      mockPostId,
      mockUserId,
      PostStatus.DRAFT,
    );

    expect(result.post.id).toBe(mockPostId);
    expect(result.socialAccount.username).toBe('test_creator');
    expect(storageService.exists).toHaveBeenCalledWith(mockMedia[0].filePath);
  });

  it('should throw NotFoundException if post does not exist or belongs to another user', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.validatePostForPublish(mockPostId, mockOtherUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if post is already PUBLISHED', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      ...mockValidPost,
      status: PostStatus.PUBLISHED,
    });

    await expect(
      service.validatePostForPublish(mockPostId, mockUserId),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException if post is currently PUBLISHING', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      ...mockValidPost,
      status: PostStatus.PUBLISHING,
    });

    await expect(
      service.validatePostForPublish(mockPostId, mockUserId),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw UnprocessableEntityException if target social account is not CONNECTED', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      ...mockValidPost,
      socialAccount: {
        ...mockSocialAccount,
        connectionStatus: ConnectionStatus.DISCONNECTED,
      },
    });

    await expect(
      service.validatePostForPublish(mockPostId, mockUserId),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should throw UnprocessableEntityException if post has no media attached', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      ...mockValidPost,
      media: [],
    });

    await expect(
      service.validatePostForPublish(mockPostId, mockUserId),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should throw UnprocessableEntityException if physical file is missing from storage', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockValidPost);
    (storageService.exists as jest.Mock).mockResolvedValue(false);

    await expect(
      service.validatePostForPublish(mockPostId, mockUserId),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
