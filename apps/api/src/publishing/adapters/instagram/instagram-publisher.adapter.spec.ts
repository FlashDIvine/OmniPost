import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { InstagramPublisherAdapter } from './instagram-publisher.adapter';
import { InstagramApiClient } from './instagram-api.client';
import { StorageService } from '../../../storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
} from '../../../../generated/prisma/client';
import { PublishContext } from '../publisher-adapter.interface';

describe('InstagramPublisherAdapter', () => {
  let adapter: InstagramPublisherAdapter;
  let apiClient: InstagramApiClient;
  let storageService: StorageService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockPostId = 'post-123';
  const mockSocialAccountId = 'account-123';
  const mockIgUserId = '17841400000000000';

  const mockSocialAccount = {
    id: mockSocialAccountId,
    platform: Platform.INSTAGRAM,
    platformAccountId: mockIgUserId,
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

  const mockImageMedia = {
    id: 'media-1',
    postId: mockPostId,
    mediaType: MediaType.IMAGE,
    fileName: 'photo.jpg',
    filePath: 'users/u1/posts/p1/img.jpg',
    fileSize: 1048576,
    mimeType: 'image/jpeg',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVideoMedia = {
    id: 'media-2',
    postId: mockPostId,
    mediaType: MediaType.VIDEO,
    fileName: 'video.mp4',
    filePath: 'users/u1/posts/p1/vid.mp4',
    fileSize: 5242880,
    mimeType: 'video/mp4',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBasePost = {
    id: mockPostId,
    caption: 'Great day at the beach #travel #sun',
    status: PostStatus.DRAFT,
    cover: 'users/u1/posts/p1/cover.jpg',
    publishedUrl: null,
    publishedAt: null,
    userId: mockUserId,
    socialAccountId: mockSocialAccountId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramPublisherAdapter,
        {
          provide: InstagramApiClient,
          useValue: {
            createImageContainer: jest
              .fn()
              .mockResolvedValue({ id: 'container_img_123' }),
            createVideoContainer: jest
              .fn()
              .mockResolvedValue({ id: 'container_vid_123' }),
            createCarouselContainer: jest
              .fn()
              .mockResolvedValue({ id: 'container_carousel_123' }),
            getContainerStatus: jest
              .fn()
              .mockResolvedValue({ statusCode: 'FINISHED' }),
            publishContainer: jest
              .fn()
              .mockResolvedValue({ id: 'ig_published_media_123' }),
            getMediaDetails: jest.fn().mockResolvedValue({
              id: 'ig_published_media_123',
              permalink: 'https://www.instagram.com/p/mock_permalink/',
            }),
            normalizeError: jest.fn((err) => ({
              message: err?.message || 'Instagram API Error',
              apiErrorCode: 'API_ERROR',
              classification: 'PERMANENT',
            })),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getExternalUrl: jest.fn(
              (key: string) => `https://cdn.example.com/media/${key}`,
            ),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            socialAccount: {
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'INSTAGRAM_MEDIA_POLL_INTERVAL_MS') return '10';
              if (key === 'INSTAGRAM_MEDIA_POLL_MAX_ATTEMPTS') return '3';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<InstagramPublisherAdapter>(InstagramPublisherAdapter);
    apiClient = module.get<InstagramApiClient>(InstagramApiClient);
    storageService = module.get<StorageService>(StorageService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('validateContent', () => {
    it('should pass validation for a valid single image post', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockImageMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).resolves.not.toThrow();
    });

    it('should reject if platform is not Instagram', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockImageMedia] },
        socialAccount: { ...mockSocialAccount, platform: Platform.TIKTOK },
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject if social account is DISCONNECTED', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockImageMedia] },
        socialAccount: {
          ...mockSocialAccount,
          connectionStatus: ConnectionStatus.DISCONNECTED,
        },
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject if media items exceed 10 for carousel', async () => {
      const elevenMedia = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockImageMedia, id: `m-${i}`, sortOrder: i }));

      const context: PublishContext = {
        post: { ...mockBasePost, media: elevenMedia },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject if caption exceeds 2200 characters', async () => {
      const longCaption = 'A'.repeat(2201);
      const context: PublishContext = {
        post: { ...mockBasePost, caption: longCaption, media: [mockImageMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject if caption exceeds 30 hashtags', async () => {
      const manyHashtags = Array(31)
        .fill(null)
        .map((_, i) => `#tag${i}`)
        .join(' ');

      const context: PublishContext = {
        post: {
          ...mockBasePost,
          caption: manyHashtags,
          media: [mockImageMedia],
        },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('publish - Single Image', () => {
    it('should execute single image container creation, polling, publish, and details flow', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockImageMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(apiClient.createImageContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        {
          imageUrl: 'https://cdn.example.com/media/users/u1/posts/p1/img.jpg',
          caption: mockBasePost.caption,
        },
      );
      expect(apiClient.getContainerStatus).toHaveBeenCalledWith(
        'container_img_123',
        'decrypted_token',
      );
      expect(apiClient.publishContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        'container_img_123',
      );
      expect(apiClient.getMediaDetails).toHaveBeenCalledWith(
        'ig_published_media_123',
        'decrypted_token',
      );

      expect(result.success).toBe(true);
      expect(result.publishedUrl).toBe(
        'https://www.instagram.com/p/mock_permalink/',
      );
      expect(result.platformPostId).toBe('ig_published_media_123');
    });
  });

  describe('publish - Single Video / Reels', () => {
    it('should execute single video container creation with cover URL and polling', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(apiClient.createVideoContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        {
          videoUrl: 'https://cdn.example.com/media/users/u1/posts/p1/vid.mp4',
          caption: mockBasePost.caption,
          coverUrl:
            'https://cdn.example.com/media/users/u1/posts/p1/cover.jpg',
        },
      );
      expect(apiClient.publishContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        'container_vid_123',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publish - Carousel Album', () => {
    it('should create child containers, poll children, create parent carousel, and publish', async () => {
      const carouselMedia = [
        { ...mockImageMedia, id: 'm-1', sortOrder: 0 },
        { ...mockVideoMedia, id: 'm-2', sortOrder: 1 },
      ];

      (apiClient.createImageContainer as jest.Mock).mockResolvedValueOnce({
        id: 'child_img_1',
      });
      (apiClient.createVideoContainer as jest.Mock).mockResolvedValueOnce({
        id: 'child_vid_2',
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: carouselMedia },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(apiClient.createImageContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        expect.objectContaining({ isCarouselItem: true }),
      );
      expect(apiClient.createVideoContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        expect.objectContaining({ isCarouselItem: true }),
      );
      expect(apiClient.createCarouselContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        {
          children: ['child_img_1', 'child_vid_2'],
          caption: mockBasePost.caption,
        },
      );
      expect(apiClient.publishContainer).toHaveBeenCalledWith(
        mockIgUserId,
        'decrypted_token',
        'container_carousel_123',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publish - Polling Timeout & Token Invalidation Handling', () => {
    it('should return retryable error when container polling times out', async () => {
      (apiClient.getContainerStatus as jest.Mock).mockResolvedValue({
        statusCode: 'IN_PROGRESS',
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockImageMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(result.success).toBe(false);
      expect(result.error?.classification).toBe('RETRYABLE');
      expect(result.error?.apiErrorCode).toBe('CONTAINER_POLL_TIMEOUT');
    });

    it('should mark social account EXPIRED in database when token error occurs', async () => {
      (apiClient.createImageContainer as jest.Mock).mockRejectedValueOnce({
        message: 'Invalid OAuth 2.0 Access Token',
        apiErrorCode: '190_463',
        classification: 'PERMANENT',
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockImageMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(result.success).toBe(false);
      expect(prisma.socialAccount.update).toHaveBeenCalledWith({
        where: { id: mockSocialAccountId },
        data: { connectionStatus: ConnectionStatus.EXPIRED },
      });
    });
  });
});
