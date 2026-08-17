import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { TikTokPublisherAdapter } from './tiktok-publisher.adapter';
import { TikTokApiClient } from './tiktok-api.client';
import { StorageService } from '../../../storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
} from '../../../../generated/prisma/client';
import { PublishContext } from '../publisher-adapter.interface';

describe('TikTokPublisherAdapter', () => {
  let adapter: TikTokPublisherAdapter;
  let apiClient: TikTokApiClient;
  let storageService: StorageService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockPostId = 'post-123';
  const mockSocialAccountId = 'account-123';
  const mockTikTokOpenId = 'tt_open_id_12345';
  const mockUsername = 'tiktok_creator';

  const mockSocialAccount = {
    id: mockSocialAccountId,
    platform: Platform.TIKTOK,
    platformAccountId: mockTikTokOpenId,
    username: mockUsername,
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

  const mockVideoMedia = {
    id: 'media-vid-1',
    postId: mockPostId,
    mediaType: MediaType.VIDEO,
    fileName: 'dance.mp4',
    filePath: 'users/u1/posts/p1/vid.mp4',
    fileSize: 5242880,
    mimeType: 'video/mp4',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJpegMedia = {
    id: 'media-img-1',
    postId: mockPostId,
    mediaType: MediaType.IMAGE,
    fileName: 'photo1.jpg',
    filePath: 'users/u1/posts/p1/img1.jpg',
    fileSize: 1048576,
    mimeType: 'image/jpeg',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWebpMedia = {
    id: 'media-img-2',
    postId: mockPostId,
    mediaType: MediaType.IMAGE,
    fileName: 'photo2.webp',
    filePath: 'users/u1/posts/p1/img2.webp',
    fileSize: 1048576,
    mimeType: 'image/webp',
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPngMedia = {
    id: 'media-img-png',
    postId: mockPostId,
    mediaType: MediaType.IMAGE,
    fileName: 'photo.png',
    filePath: 'users/u1/posts/p1/img.png',
    fileSize: 1048576,
    mimeType: 'image/png',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBasePost = {
    id: mockPostId,
    caption: 'My TikTok Post #fyp #trending',
    status: PostStatus.DRAFT,
    cover: null,
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
        TikTokPublisherAdapter,
        {
          provide: TikTokApiClient,
          useValue: {
            queryCreatorInfo: jest.fn().mockResolvedValue({
              creator_username: mockUsername,
              privacy_level_options: [
                'PUBLIC_TO_EVERYONE',
                'MUTUAL_FOLLOW_FRIENDS',
                'SELF_ONLY',
              ],
              comment_disabled: false,
              duet_disabled: false,
              stitch_disabled: false,
              max_video_post_duration_sec: 600,
            }),
            initVideoPublish: jest
              .fn()
              .mockResolvedValue({ publish_id: 'v_pub_vid_999' }),
            initPhotoPublish: jest
              .fn()
              .mockResolvedValue({ publish_id: 'v_pub_photo_888' }),
            fetchPublishStatus: jest.fn().mockResolvedValue({
              status: 'PUBLISH_COMPLETE',
              public_post_id: '7999888777666555444',
            }),
            normalizeError: jest.fn((err) => ({
              message: err?.message || 'TikTok API Error',
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
              if (key === 'TIKTOK_MEDIA_POLL_INTERVAL_MS') return '10';
              if (key === 'TIKTOK_MEDIA_POLL_MAX_ATTEMPTS') return '3';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<TikTokPublisherAdapter>(TikTokPublisherAdapter);
    apiClient = module.get<TikTokApiClient>(TikTokApiClient);
    storageService = module.get<StorageService>(StorageService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('validateContent', () => {
    it('should pass validation for a valid single video post', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).resolves.not.toThrow();
    });

    it('should pass validation for valid photo post (JPEG and WEBP)', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockJpegMedia, mockWebpMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).resolves.not.toThrow();
    });

    it('should reject if platform is not TikTok', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: { ...mockSocialAccount, platform: Platform.INSTAGRAM },
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject if social account is DISCONNECTED or EXPIRED', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
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

    it('should reject if post has no media', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject mixed video and image media items', async () => {
      const context: PublishContext = {
        post: {
          ...mockBasePost,
          media: [mockVideoMedia, mockJpegMedia],
        },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject multiple videos (>1)', async () => {
      const secondVideo = { ...mockVideoMedia, id: 'vid-2', sortOrder: 1 };
      const context: PublishContext = {
        post: {
          ...mockBasePost,
          media: [mockVideoMedia, secondVideo],
        },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject unsupported video format', async () => {
      const aviVideo = {
        ...mockVideoMedia,
        mimeType: 'video/x-msvideo',
        fileName: 'clip.avi',
      };
      const context: PublishContext = {
        post: { ...mockBasePost, media: [aviVideo] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject unsupported photo format (PNG)', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockPngMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject photo count exceeding 35', async () => {
      const thirtySixPhotos = Array(36)
        .fill(null)
        .map((_, i) => ({
          ...mockJpegMedia,
          id: `img-${i}`,
          sortOrder: i,
        }));

      const context: PublishContext = {
        post: { ...mockBasePost, media: thirtySixPhotos },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject caption exceeding 2200 characters', async () => {
      const longCaption = 'X'.repeat(2201);
      const context: PublishContext = {
        post: { ...mockBasePost, caption: longCaption, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      await expect(adapter.validateContent(context)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('publish - Video Flow', () => {
    it('should query creator info, initialize video publish with external URL, poll status, and return permalink', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(apiClient.queryCreatorInfo).toHaveBeenCalledWith('decrypted_token');
      expect(apiClient.initVideoPublish).toHaveBeenCalledWith(
        'decrypted_token',
        {
          post_info: {
            title: mockBasePost.caption,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url:
              'https://cdn.example.com/media/users/u1/posts/p1/vid.mp4',
          },
        },
      );
      expect(apiClient.fetchPublishStatus).toHaveBeenCalledWith(
        'decrypted_token',
        'v_pub_vid_999',
      );

      expect(result.success).toBe(true);
      expect(result.publishedUrl).toBe(
        `https://www.tiktok.com/@${mockUsername}/video/7999888777666555444`,
      );
      expect(result.platformPostId).toBe('7999888777666555444');
    });

    it('should fallback to first allowed privacy level if PUBLIC_TO_EVERYONE is not available', async () => {
      (apiClient.queryCreatorInfo as jest.Mock).mockResolvedValueOnce({
        creator_username: mockUsername,
        privacy_level_options: ['MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
        comment_disabled: true,
        duet_disabled: true,
        stitch_disabled: true,
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(apiClient.initVideoPublish).toHaveBeenCalledWith(
        'decrypted_token',
        expect.objectContaining({
          post_info: {
            title: mockBasePost.caption,
            privacy_level: 'MUTUAL_FOLLOW_FRIENDS',
            disable_comment: true,
            disable_duet: true,
            disable_stitch: true,
          },
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publish - Photo Flow', () => {
    it('should query creator info, initialize photo publish with external URLs, poll status, and return photo permalink', async () => {
      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockJpegMedia, mockWebpMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(apiClient.initPhotoPublish).toHaveBeenCalledWith(
        'decrypted_token',
        {
          media_type: 'PHOTO',
          post_mode: 'DIRECT_POST',
          post_info: {
            title: mockBasePost.caption,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_comment: false,
            auto_add_music: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            photo_cover_index: 1,
            photo_images: [
              'https://cdn.example.com/media/users/u1/posts/p1/img1.jpg',
              'https://cdn.example.com/media/users/u1/posts/p1/img2.webp',
            ],
          },
        },
      );

      expect(result.success).toBe(true);
      expect(result.publishedUrl).toBe(
        `https://www.tiktok.com/@${mockUsername}/photo/7999888777666555444`,
      );
    });
  });

  describe('publish - Polling Timeout, Failures & Token Expiration', () => {
    it('should return retryable error when status polling times out', async () => {
      (apiClient.fetchPublishStatus as jest.Mock).mockResolvedValue({
        status: 'PROCESSING_DOWNLOAD',
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(result.success).toBe(false);
      expect(result.error?.classification).toBe('RETRYABLE');
      expect(result.error?.apiErrorCode).toBe('TIKTOK_POLL_TIMEOUT');
    });

    it('should return permanent error when TikTok server processing status is FAILED', async () => {
      (apiClient.fetchPublishStatus as jest.Mock).mockResolvedValue({
        status: 'FAILED',
        fail_reason: 'Video violated community guidelines',
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
        socialAccount: mockSocialAccount,
        accessToken: 'decrypted_token',
      };

      const result = await adapter.publish(context);

      expect(result.success).toBe(false);
      expect(result.error?.classification).toBe('PERMANENT');
      expect(result.error?.apiErrorCode).toBe('TIKTOK_PUBLISH_FAILED');
      expect(result.error?.message).toContain('violated community guidelines');
    });

    it('should mark SocialAccount as EXPIRED when token invalidation occurs', async () => {
      (apiClient.queryCreatorInfo as jest.Mock).mockRejectedValueOnce({
        message: 'The access token has expired',
        apiErrorCode: 'access_token_invalid',
        classification: 'PERMANENT',
      });

      const context: PublishContext = {
        post: { ...mockBasePost, media: [mockVideoMedia] },
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
