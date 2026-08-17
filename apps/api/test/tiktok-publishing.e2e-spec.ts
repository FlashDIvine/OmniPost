import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SocialAccountsService } from '../src/social-accounts/social-accounts.service';
import { TikTokApiClient } from '../src/publishing/adapters/tiktok/tiktok-api.client';
import {
  ConnectionStatus,
  Platform,
  PostStatus,
  PublishAttemptStatus,
} from '../generated/prisma/client';

describe('TikTokPublishing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;
  let apiClient: TikTokApiClient;
  let tempStorageRoot: string;

  const userA = {
    username: `tt_pub_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `tt_pub_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  let accountAId: string;
  let disconnectedAccountId: string;
  const ttPlatformAccountId = 'tt_open_id_e2e_999';
  const ttUsername = 'alice_tiktok_creator';

  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48,
  ]);

  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
    0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25, 0xa4, 0x00,
    0x03, 0x70, 0x00, 0xfe, 0xfb, 0xfd, 0x50, 0x00,
  ]);

  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00,
  ]);

  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);

  beforeAll(async () => {
    tempStorageRoot = path.join(
      os.tmpdir(),
      `omnipost-e2e-tt-pub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.MEDIA_STORAGE_ROOT = tempStorageRoot;
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://cdn.example.com/media';
    process.env.TIKTOK_MEDIA_POLL_INTERVAL_MS = '10';
    process.env.TIKTOK_MEDIA_POLL_MAX_ATTEMPTS = '3';
    await fs.promises.mkdir(tempStorageRoot, { recursive: true });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
    socialAccountsService = app.get(SocialAccountsService);
    apiClient = app.get(TikTokApiClient);

    // Register User A & User B
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userA)
      .expect(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.accessToken;

    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userB)
      .expect(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.accessToken;

    // Connect TikTok account for User A
    const accA = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.TIKTOK,
      platformAccountId: ttPlatformAccountId,
      username: ttUsername,
      accessToken: 'act.test_tiktok_e2e_token',
      profileImageUrl: 'https://p16.tiktokcdn.com/alice.jpg',
      tokenExpiry: new Date('2026-12-31T00:00:00.000Z'),
    });
    accountAId = accA.id;

    // Connect disconnected TikTok account for User A
    const accDisc = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.TIKTOK,
      platformAccountId: `tt_disc_${Date.now()}`,
      username: 'alice_disconnected_tt',
      accessToken: 'act.expired_token',
      profileImageUrl: null,
      tokenExpiry: new Date('2026-01-01T00:00:00.000Z'),
    });
    await prisma.socialAccount.update({
      where: { id: accDisc.id },
      data: { connectionStatus: ConnectionStatus.DISCONNECTED },
    });
    disconnectedAccountId = accDisc.id;
  }, 30000);

  beforeEach(async () => {
    // Reset accountA to CONNECTED before each test in case a prior test marked it EXPIRED
    if (accountAId && prisma) {
      await prisma.socialAccount.update({
        where: { id: accountAId },
        data: { connectionStatus: ConnectionStatus.CONNECTED },
      });
    }
  });

  afterAll(async () => {
    try {
      await prisma.publishAttempt.deleteMany({
        where: {
          post: {
            userId: { in: [userAId, userBId] },
          },
        },
      });
      await prisma.media.deleteMany({
        where: {
          post: {
            userId: { in: [userAId, userBId] },
          },
        },
      });
      await prisma.post.deleteMany({
        where: {
          userId: { in: [userAId, userBId] },
        },
      });
      await prisma.socialAccount.deleteMany({
        where: {
          userId: { in: [userAId, userBId] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [userAId, userBId] },
        },
      });
      await fs.promises.rm(tempStorageRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  // Helper to create a draft post with media
  async function createPostWithMedia(
    caption: string,
    files: Array<{ buffer: Buffer; filename: string }>,
    targetAccountId = accountAId,
  ): Promise<string> {
    const postRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        caption,
        socialAccountId: targetAccountId,
      })
      .expect(201);

    const postId = postRes.body.id;

    for (const f of files) {
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', f.buffer, f.filename)
        .expect(201);
    }

    return postId;
  }

  describe('Single Video Publishing Flow', () => {
    it('should publish a single video post to TikTok (200 OK)', async () => {
      const postId = await createPostWithMedia('Dance routine #dance #viral', [
        { buffer: validMp4Buffer, filename: 'dance.mp4' },
      ]);

      // Mock TikTok API client methods
      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValueOnce({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS'],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: false,
        max_video_post_duration_sec: 600,
      });
      jest.spyOn(apiClient, 'initVideoPublish').mockResolvedValueOnce({
        publish_id: 'v_pub_vid_e2e_001',
      });
      jest.spyOn(apiClient, 'fetchPublishStatus').mockResolvedValueOnce({
        status: 'PUBLISH_COMPLETE',
        public_post_id: '7111222333444555666',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(res.body.post.publishedUrl).toBe(
        `https://www.tiktok.com/@${ttUsername}/video/7111222333444555666`,
      );
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
      expect(res.body.attempt.errorMessage).toBeNull();
      expect(res.body.post.socialAccount).not.toHaveProperty('accessToken');
    });
  });

  describe('Photo Publishing Flow', () => {
    it('should publish a multi-photo post (JPEG & WEBP) to TikTok (200 OK)', async () => {
      const postId = await createPostWithMedia('Photo collection #travel #nature', [
        { buffer: validJpegBuffer, filename: 'nature1.jpg' },
        { buffer: validWebpBuffer, filename: 'nature2.webp' },
      ]);

      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValueOnce({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE'],
        comment_disabled: false,
      });
      jest.spyOn(apiClient, 'initPhotoPublish').mockResolvedValueOnce({
        publish_id: 'v_pub_photo_e2e_002',
      });
      jest.spyOn(apiClient, 'fetchPublishStatus').mockResolvedValueOnce({
        status: 'PUBLISH_COMPLETE',
        public_post_id: '7222333444555666777',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(res.body.post.publishedUrl).toBe(
        `https://www.tiktok.com/@${ttUsername}/photo/7222333444555666777`,
      );
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
    });
  });

  describe('Validation & Security Protections', () => {
    it('should reject unauthenticated publish request (401)', async () => {
      const postId = await createPostWithMedia('Unauthenticated post', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .expect(401);
    });

    it('should reject publish attempt on foreign user post (404 NotFound)', async () => {
      const postId = await createPostWithMedia('Foreign user post', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('should reject publish for post with disconnected TikTok account (422 UnprocessableEntity)', async () => {
      const postId = await createPostWithMedia(
        'Disconnected account post',
        [{ buffer: validMp4Buffer, filename: 'video.mp4' }],
        disconnectedAccountId,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(422);

      expect(res.body.message).toContain('not connected');
    });

    it('should fail publishing post with unsupported photo format PNG and record FAILED attempt', async () => {
      const postId = await createPostWithMedia('PNG photo post', [
        { buffer: pngBuffer, filename: 'image.png' },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.errorMessage).toContain(
        'Unsupported photo format for TikTok',
      );
    });

    it('should fail publishing post with multiple videos and record FAILED attempt', async () => {
      const postId = await createPostWithMedia('Two videos post', [
        { buffer: validMp4Buffer, filename: 'video1.mp4' },
        { buffer: validMp4Buffer, filename: 'video2.mp4' },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.errorMessage).toContain(
        'allows only exactly 1 video',
      );
    });

    it('should fail publishing post with mixed video and image and record FAILED attempt', async () => {
      const postId = await createPostWithMedia('Mixed media post', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
        { buffer: validJpegBuffer, filename: 'photo.jpg' },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.errorMessage).toContain(
        'does not support mixed video and photo',
      );
    });
  });

  describe('Error Handling, Polling Timeout & Token Invalidation', () => {
    it('should handle rate limit 429 and mark post as FAILED without changing account status', async () => {
      const postId = await createPostWithMedia('Rate limited video', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValueOnce({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE'],
      });
      jest.spyOn(apiClient, 'initVideoPublish').mockRejectedValueOnce({
        message: 'Rate limit reached, please try again later',
        apiErrorCode: 'spam_risk_user_rate_limit',
        classification: 'RETRYABLE',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.apiErrorCode).toBe('spam_risk_user_rate_limit');

      // Account remains CONNECTED
      const acc = await prisma.socialAccount.findUnique({
        where: { id: accountAId },
      });
      expect(acc?.connectionStatus).toBe(ConnectionStatus.CONNECTED);
    });

    it('should handle TikTok FAILED status during status polling', async () => {
      const postId = await createPostWithMedia('Policy violation video', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValueOnce({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE'],
      });
      jest.spyOn(apiClient, 'initVideoPublish').mockResolvedValueOnce({
        publish_id: 'v_pub_vid_fail_001',
      });
      jest.spyOn(apiClient, 'fetchPublishStatus').mockResolvedValueOnce({
        status: 'FAILED',
        fail_reason: 'Video content was rejected by moderation',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.apiErrorCode).toBe('TIKTOK_PUBLISH_FAILED');
      expect(res.body.attempt.errorMessage).toContain('rejected by moderation');
    });

    it('should handle polling timeout as RETRYABLE failure', async () => {
      const postId = await createPostWithMedia('Stuck processing video', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValueOnce({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE'],
      });
      jest.spyOn(apiClient, 'initVideoPublish').mockResolvedValueOnce({
        publish_id: 'v_pub_vid_stuck_001',
      });
      jest.spyOn(apiClient, 'fetchPublishStatus').mockResolvedValue({
        status: 'PROCESSING_DOWNLOAD',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.apiErrorCode).toBe('TIKTOK_POLL_TIMEOUT');
    });

    it('should handle expired / invalid token and update SocialAccount to EXPIRED', async () => {
      const postId = await createPostWithMedia('Expired token video', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      jest.spyOn(apiClient, 'queryCreatorInfo').mockRejectedValueOnce({
        message: 'The access token is invalid or expired',
        apiErrorCode: 'access_token_invalid',
        classification: 'PERMANENT',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.apiErrorCode).toBe('access_token_invalid');

      // Social account is marked EXPIRED in database
      const acc = await prisma.socialAccount.findUnique({
        where: { id: accountAId },
      });
      expect(acc?.connectionStatus).toBe(ConnectionStatus.EXPIRED);
    });
  });

  describe('Concurrent Publish Protection & Retry Flow', () => {
    it('should prevent duplicate publishing when two requests arrive simultaneously', async () => {
      const concurrentPostId = await createPostWithMedia('Concurrent TikTok post', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValue({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE'],
      });
      jest.spyOn(apiClient, 'initVideoPublish').mockResolvedValue({
        publish_id: 'v_pub_vid_concurrent',
      });
      jest.spyOn(apiClient, 'fetchPublishStatus').mockResolvedValue({
        status: 'PUBLISH_COMPLETE',
        public_post_id: '7333444555666777888',
      });

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/posts/${concurrentPostId}/publish`)
          .set('Authorization', `Bearer ${userAToken}`),
        request(app.getHttpServer())
          .post(`/api/posts/${concurrentPostId}/publish`)
          .set('Authorization', `Bearer ${userAToken}`),
      ]);

      const statusCodes = [res1.status, res2.status].sort();
      expect(statusCodes).toEqual([200, 409]);

      const successRes = res1.status === 200 ? res1 : res2;
      expect(successRes.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(successRes.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
    });

    it('should allow retrying a FAILED TikTok post via POST /api/posts/:id/retry', async () => {
      const retryPostId = await createPostWithMedia('Failed then retry video', [
        { buffer: validMp4Buffer, filename: 'video.mp4' },
      ]);

      // 1. First publish fails
      jest.spyOn(apiClient, 'queryCreatorInfo').mockRejectedValueOnce({
        message: 'TikTok temporary 503 error',
        apiErrorCode: '50000',
        classification: 'RETRYABLE',
      });

      const failRes = await request(app.getHttpServer())
        .post(`/api/posts/${retryPostId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(failRes.body.post.status).toBe(PostStatus.FAILED);
      expect(failRes.body.attempt.status).toBe(PublishAttemptStatus.FAILED);

      // 2. Retry succeeds
      jest.spyOn(apiClient, 'queryCreatorInfo').mockResolvedValueOnce({
        creator_username: ttUsername,
        privacy_level_options: ['PUBLIC_TO_EVERYONE'],
      });
      jest.spyOn(apiClient, 'initVideoPublish').mockResolvedValueOnce({
        publish_id: 'v_pub_vid_retry_ok',
      });
      jest.spyOn(apiClient, 'fetchPublishStatus').mockResolvedValueOnce({
        status: 'PUBLISH_COMPLETE',
        public_post_id: '7444555666777888999',
      });

      const retryRes = await request(app.getHttpServer())
        .post(`/api/posts/${retryPostId}/retry`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(retryRes.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(retryRes.body.post.publishedUrl).toBe(
        `https://www.tiktok.com/@${ttUsername}/video/7444555666777888999`,
      );
      expect(retryRes.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);

      // Exactly 2 attempts in DB
      const attempts = await prisma.publishAttempt.findMany({
        where: { postId: retryPostId },
        orderBy: { startedAt: 'asc' },
      });
      expect(attempts).toHaveLength(2);
      expect(attempts[0].status).toBe(PublishAttemptStatus.FAILED);
      expect(attempts[1].status).toBe(PublishAttemptStatus.SUCCESS);
    });
  });
});
