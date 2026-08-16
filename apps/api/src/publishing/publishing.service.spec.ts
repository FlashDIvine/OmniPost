import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { PublishValidationService } from './services/publish-validation.service';
import { PublisherRegistry } from './registry/publisher.registry';
import { MockPublisherAdapter } from './adapters/mock-publisher.adapter';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
  PublishAttemptStatus,
} from '../../generated/prisma/client';

describe('PublishingService', () => {
  let service: PublishingService;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;
  let validationService: PublishValidationService;
  let mockAdapter: MockPublisherAdapter;

  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';
  const mockPostId = 'post-123';
  const mockAttemptId = 'attempt-123';

  const mockSocialAccount = {
    id: 'account-123',
    platform: Platform.INSTAGRAM,
    platformAccountId: 'ig-123',
    username: 'alice_creator',
    profileImageUrl: null,
    accessToken: 'encrypted_access_token',
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

  const mockDraftPost = {
    id: mockPostId,
    caption: 'Test draft post',
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

  const mockPendingAttempt = {
    id: mockAttemptId,
    postId: mockPostId,
    status: PublishAttemptStatus.PENDING,
    errorMessage: null,
    apiErrorCode: null,
    startedAt: new Date(),
    finishedAt: null,
  };

  beforeEach(async () => {
    mockAdapter = new MockPublisherAdapter(Platform.INSTAGRAM);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishingService,
        {
          provide: PrismaService,
          useValue: {
            post: {
              findFirst: jest.fn(),
              updateMany: jest.fn(),
              update: jest.fn(),
            },
            publishAttempt: {
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn((promises) => Promise.all(promises)),
          },
        },
        {
          provide: SocialAccountsService,
          useValue: {
            getDecryptedAccessToken: jest
              .fn()
              .mockResolvedValue('decrypted_token_secret'),
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
          provide: PublishValidationService,
          useValue: {
            validatePostForPublish: jest.fn(),
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

    service = module.get<PublishingService>(PublishingService);
    prisma = module.get<PrismaService>(PrismaService);
    socialAccountsService =
      module.get<SocialAccountsService>(SocialAccountsService);
    validationService = module.get<PublishValidationService>(
      PublishValidationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishPost', () => {
    it('should complete full successful publish lifecycle', async () => {
      (validationService.validatePostForPublish as jest.Mock).mockResolvedValue({
        post: mockDraftPost,
        socialAccount: mockSocialAccount,
      });

      // Atomic claim succeeds
      (prisma.post.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      // Create attempt
      (prisma.publishAttempt.create as jest.Mock).mockResolvedValue(
        mockPendingAttempt,
      );

      // Finalize updates
      const finalizedPost = {
        ...mockDraftPost,
        status: PostStatus.PUBLISHED,
        publishedUrl: `https://instagram.com/p/mock_${mockPostId}`,
        publishedAt: new Date(),
      };
      const finalizedAttempt = {
        ...mockPendingAttempt,
        status: PublishAttemptStatus.SUCCESS,
        finishedAt: new Date(),
      };

      (prisma.post.update as jest.Mock).mockResolvedValue(finalizedPost);
      (prisma.publishAttempt.update as jest.Mock).mockResolvedValue(
        finalizedAttempt,
      );

      const result = await service.publishPost(mockPostId, mockUserId);

      expect(validationService.validatePostForPublish).toHaveBeenCalledWith(
        mockPostId,
        mockUserId,
        PostStatus.DRAFT,
      );
      expect(prisma.post.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockPostId,
          userId: mockUserId,
          status: PostStatus.DRAFT,
        },
        data: {
          status: PostStatus.PUBLISHING,
        },
      });
      expect(prisma.publishAttempt.create).toHaveBeenCalled();
      expect(socialAccountsService.getDecryptedAccessToken).toHaveBeenCalledWith(
        mockSocialAccount.id,
        mockUserId,
      );

      expect(result.post.status).toBe(PostStatus.PUBLISHED);
      expect(result.post.publishedUrl).toContain('instagram.com');
      expect(result.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
      expect(result.post.socialAccount).not.toHaveProperty('accessToken');
    });

    it('should handle publisher failure and update post/attempt to FAILED', async () => {
      (validationService.validatePostForPublish as jest.Mock).mockResolvedValue({
        post: mockDraftPost,
        socialAccount: mockSocialAccount,
      });

      (prisma.post.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.publishAttempt.create as jest.Mock).mockResolvedValue(
        mockPendingAttempt,
      );

      mockAdapter.setFailure({
        message: 'Instagram Graph API rate limit exceeded with EAAG_token',
        apiErrorCode: 'IG_RATE_LIMIT',
        classification: 'RETRYABLE',
      });

      const finalizedPost = {
        ...mockDraftPost,
        status: PostStatus.FAILED,
      };
      const finalizedAttempt = {
        ...mockPendingAttempt,
        status: PublishAttemptStatus.FAILED,
        errorMessage: 'Instagram Graph API rate limit exceeded with [REDACTED_TOKEN]',
        apiErrorCode: 'IG_RATE_LIMIT',
        finishedAt: new Date(),
      };

      (prisma.post.update as jest.Mock).mockResolvedValue(finalizedPost);
      (prisma.publishAttempt.update as jest.Mock).mockResolvedValue(
        finalizedAttempt,
      );

      const result = await service.publishPost(mockPostId, mockUserId);

      expect(result.post.status).toBe(PostStatus.FAILED);
      expect(result.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(result.attempt.errorMessage).not.toContain('EAAG_token');
    });

    it('should throw ConflictException if atomic claim fails (concurrency collision)', async () => {
      (validationService.validatePostForPublish as jest.Mock).mockResolvedValue({
        post: mockDraftPost,
        socialAccount: mockSocialAccount,
      });

      // Claim count is 0 (another concurrent request claimed first)
      (prisma.post.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        service.publishPost(mockPostId, mockUserId),
      ).rejects.toThrow(ConflictException);

      expect(prisma.publishAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('retryPublish', () => {
    it('should retry a post in FAILED status, create a new attempt, and transition to PUBLISHED', async () => {
      const failedPost = {
        ...mockDraftPost,
        status: PostStatus.FAILED,
      };

      (validationService.validatePostForPublish as jest.Mock).mockResolvedValue({
        post: failedPost,
        socialAccount: mockSocialAccount,
      });

      (prisma.post.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const newAttempt = {
        id: 'new-attempt-456',
        postId: mockPostId,
        status: PublishAttemptStatus.PENDING,
        errorMessage: null,
        apiErrorCode: null,
        startedAt: new Date(),
        finishedAt: null,
      };

      (prisma.publishAttempt.create as jest.Mock).mockResolvedValue(newAttempt);

      const finalizedPost = {
        ...failedPost,
        status: PostStatus.PUBLISHED,
        publishedUrl: `https://instagram.com/p/mock_${mockPostId}`,
        publishedAt: new Date(),
      };
      const finalizedAttempt = {
        ...newAttempt,
        status: PublishAttemptStatus.SUCCESS,
        finishedAt: new Date(),
      };

      (prisma.post.update as jest.Mock).mockResolvedValue(finalizedPost);
      (prisma.publishAttempt.update as jest.Mock).mockResolvedValue(
        finalizedAttempt,
      );

      const result = await service.retryPublish(mockPostId, mockUserId);

      expect(validationService.validatePostForPublish).toHaveBeenCalledWith(
        mockPostId,
        mockUserId,
        PostStatus.FAILED,
      );
      expect(prisma.post.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockPostId,
          userId: mockUserId,
          status: PostStatus.FAILED,
        },
        data: {
          status: PostStatus.PUBLISHING,
        },
      });

      expect(result.post.status).toBe(PostStatus.PUBLISHED);
      expect(result.attempt.id).toBe('new-attempt-456');
      expect(result.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
    });
  });

  describe('getPublishAttemptsForPost', () => {
    it('should return attempts list for owned post', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(mockDraftPost);
      (prisma.publishAttempt.findMany as jest.Mock).mockResolvedValue([
        mockPendingAttempt,
      ]);

      const attempts = await service.getPublishAttemptsForPost(
        mockPostId,
        mockUserId,
      );

      expect(attempts).toHaveLength(1);
      expect(attempts[0].id).toBe(mockAttemptId);
    });

    it('should throw NotFoundException if post belongs to another user', async () => {
      (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getPublishAttemptsForPost(mockPostId, mockOtherUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
