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
import { InstagramApiClient } from '../src/publishing/adapters/instagram/instagram-api.client';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
  PublishAttemptStatus,
} from '../generated/prisma/client';

describe('InstagramPublishing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;
  let apiClient: InstagramApiClient;
  let tempStorageRoot: string;

  const userA = {
    username: `ig_pub_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `ig_pub_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  let accountAId: string;
  const igPlatformAccountId = '17841400000000001';

  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48,
  ]);

  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00,
  ]);

  beforeAll(async () => {
    tempStorageRoot = path.join(
      os.tmpdir(),
      `omnipost-e2e-ig-pub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.MEDIA_STORAGE_ROOT = tempStorageRoot;
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://cdn.example.com/media';
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
    apiClient = app.get(InstagramApiClient);

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

    // Connect Instagram account for User A
    const accA = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.INSTAGRAM,
      platformAccountId: igPlatformAccountId,
      username: 'alice_instagram_creator',
      accessToken: 'EAAG_test_instagram_token',
      profileImageUrl: 'https://example.com/alice.jpg',
      tokenExpiry: new Date('2026-12-31T00:00:00.000Z'),
    });
    accountAId = accA.id;
  }, 30000);

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
  ): Promise<string> {
    const postRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        caption,
        socialAccountId: accountAId,
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

  describe('Single Image Publishing Flow', () => {
    it('should publish a single image post to Instagram (200 OK)', async () => {
      const postId = await createPostWithMedia('Sunset view #ocean #travel', [
        { buffer: validJpegBuffer, filename: 'beach.jpg' },
      ]);

      // Mock Instagram API client methods
      jest.spyOn(apiClient, 'createImageContainer').mockResolvedValueOnce({
        id: 'container_img_001',
      });
      jest.spyOn(apiClient, 'getContainerStatus').mockResolvedValueOnce({
        statusCode: 'FINISHED',
      });
      jest.spyOn(apiClient, 'publishContainer').mockResolvedValueOnce({
        id: '17841400000000001_post_001',
      });
      jest.spyOn(apiClient, 'getMediaDetails').mockResolvedValueOnce({
        id: '17841400000000001_post_001',
        permalink: 'https://www.instagram.com/p/CxyzBeach01/',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(res.body.post.publishedUrl).toBe(
        'https://www.instagram.com/p/CxyzBeach01/',
      );
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
      expect(res.body.attempt.errorMessage).toBeNull();
      expect(res.body.post.socialAccount).not.toHaveProperty('accessToken');
    });
  });

  describe('Single Video / Reels Publishing Flow', () => {
    it('should publish a single video post to Instagram (200 OK)', async () => {
      const postId = await createPostWithMedia('Exciting Reel #reels #viral', [
        { buffer: validMp4Buffer, filename: 'teaser.mp4' },
      ]);

      jest.spyOn(apiClient, 'createVideoContainer').mockResolvedValueOnce({
        id: 'container_vid_001',
      });
      jest.spyOn(apiClient, 'getContainerStatus').mockResolvedValueOnce({
        statusCode: 'FINISHED',
      });
      jest.spyOn(apiClient, 'publishContainer').mockResolvedValueOnce({
        id: '17841400000000001_post_vid_001',
      });
      jest.spyOn(apiClient, 'getMediaDetails').mockResolvedValueOnce({
        id: '17841400000000001_post_vid_001',
        permalink: 'https://www.instagram.com/reel/CxyzReel01/',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(res.body.post.publishedUrl).toBe(
        'https://www.instagram.com/reel/CxyzReel01/',
      );
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
    });
  });

  describe('Carousel Album Publishing Flow', () => {
    it('should publish mixed image and video carousel to Instagram (200 OK)', async () => {
      const postId = await createPostWithMedia('Multi-photo vacation album', [
        { buffer: validJpegBuffer, filename: 'photo1.jpg' },
        { buffer: validMp4Buffer, filename: 'video2.mp4' },
      ]);

      jest.spyOn(apiClient, 'createImageContainer').mockResolvedValueOnce({
        id: 'child_c1',
      });
      jest.spyOn(apiClient, 'createVideoContainer').mockResolvedValueOnce({
        id: 'child_c2',
      });
      jest.spyOn(apiClient, 'getContainerStatus').mockResolvedValue({
        statusCode: 'FINISHED',
      });
      jest.spyOn(apiClient, 'createCarouselContainer').mockResolvedValueOnce({
        id: 'parent_carousel_001',
      });
      jest.spyOn(apiClient, 'publishContainer').mockResolvedValueOnce({
        id: '17841400000000001_post_carousel_001',
      });
      jest.spyOn(apiClient, 'getMediaDetails').mockResolvedValueOnce({
        id: '17841400000000001_post_carousel_001',
        permalink: 'https://www.instagram.com/p/CxyzCarousel01/',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(res.body.post.publishedUrl).toBe(
        'https://www.instagram.com/p/CxyzCarousel01/',
      );
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
    });
  });

  describe('Error Handling & Account Expiration', () => {
    it('should handle rate limit 429 and mark post as FAILED without modifying account status', async () => {
      const postId = await createPostWithMedia('Rate limited post', [
        { buffer: validJpegBuffer, filename: 'img.jpg' },
      ]);

      jest.spyOn(apiClient, 'createImageContainer').mockRejectedValueOnce({
        message: 'Application request limit reached',
        apiErrorCode: '32',
        classification: 'RETRYABLE',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.apiErrorCode).toBe('32');

      // Social account remains CONNECTED for rate limit
      const acc = await prisma.socialAccount.findUnique({
        where: { id: accountAId },
      });
      expect(acc?.connectionStatus).toBe(ConnectionStatus.CONNECTED);
    });

    it('should handle invalid OAuth token (code 190) and update SocialAccount to EXPIRED', async () => {
      const postId = await createPostWithMedia('Expired token post', [
        { buffer: validJpegBuffer, filename: 'img.jpg' },
      ]);

      jest.spyOn(apiClient, 'createImageContainer').mockRejectedValueOnce({
        message: 'Error validating access token: Session has expired',
        apiErrorCode: '190_463',
        classification: 'PERMANENT',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.FAILED);
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(res.body.attempt.apiErrorCode).toBe('190_463');

      // Social account is marked EXPIRED in database
      const acc = await prisma.socialAccount.findUnique({
        where: { id: accountAId },
      });
      expect(acc?.connectionStatus).toBe(ConnectionStatus.EXPIRED);
    });
  });
});
