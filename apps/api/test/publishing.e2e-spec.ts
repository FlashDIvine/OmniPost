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
import { StorageService } from '../src/storage/storage.service';
import { PublisherRegistry } from '../src/publishing/registry/publisher.registry';
import { MockPublisherAdapter } from '../src/publishing/adapters/mock-publisher.adapter';
import {
  ConnectionStatus,
  MediaType,
  Platform,
  PostStatus,
  PublishAttemptStatus,
} from '../generated/prisma/client';

describe('PublishingEngine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;
  let storageService: StorageService;
  let publisherRegistry: PublisherRegistry;
  let mockInstagramAdapter: MockPublisherAdapter;
  let tempStorageRoot: string;

  const userA = {
    username: `pub_user_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `pub_user_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  let accountAId: string;
  let disconnectedAccountId: string;

  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48,
  ]);

  beforeAll(async () => {
    tempStorageRoot = path.join(
      os.tmpdir(),
      `omnipost-e2e-pub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.MEDIA_STORAGE_ROOT = tempStorageRoot;
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
    storageService = app.get(StorageService);
    publisherRegistry = app.get(PublisherRegistry);

    // Replace or configure mock adapter in registry
    mockInstagramAdapter = new MockPublisherAdapter(Platform.INSTAGRAM);
    publisherRegistry.register(mockInstagramAdapter);

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

    // Connect valid Instagram account for User A
    const accA = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.INSTAGRAM,
      platformAccountId: `ig_pub_${Date.now()}`,
      username: 'alice_publisher',
      accessToken: 'EAAG_mock_instagram_token',
      profileImageUrl: 'https://example.com/alice.jpg',
      tokenExpiry: new Date('2026-12-31T00:00:00.000Z'),
    });
    accountAId = accA.id;

    // Connect disconnected account for User A
    const accDisc = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.INSTAGRAM,
      platformAccountId: `ig_disc_${Date.now()}`,
      username: 'alice_disconnected',
      accessToken: 'EAAG_expired_token',
      profileImageUrl: null,
      tokenExpiry: new Date('2026-01-01T00:00:00.000Z'),
    });
    await prisma.socialAccount.update({
      where: { id: accDisc.id },
      data: { connectionStatus: ConnectionStatus.DISCONNECTED },
    });
    disconnectedAccountId = accDisc.id;
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

  beforeEach(() => {
    mockInstagramAdapter.reset();
  });

  // Helper to create a draft post with physical media file
  async function createDraftPostWithMedia(
    caption = 'Test publishing post',
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

    // Upload physical media file
    await request(app.getHttpServer())
      .post(`/api/posts/${postId}/media`)
      .set('Authorization', `Bearer ${userAToken}`)
      .attach('file', validJpegBuffer, 'image.jpg')
      .expect(201);

    return postId;
  }

  describe('POST /api/posts/:id/publish (Basic Scenarios & Validation)', () => {
    it('should reject unauthenticated publish request (401)', async () => {
      const postId = await createDraftPostWithMedia();
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .expect(401);
    });

    it('should reject publish attempt on foreign post (404 NotFound)', async () => {
      const postId = await createDraftPostWithMedia();
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('should reject publish for post without media (422 UnprocessableEntity)', async () => {
      const emptyPostRes = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          caption: 'Post without media',
          socialAccountId: accountAId,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${emptyPostRes.body.id}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(422);

      expect(res.body.message).toContain('without attached media assets');

      // Post status remains DRAFT
      const post = await prisma.post.findUnique({
        where: { id: emptyPostRes.body.id },
      });
      expect(post?.status).toBe(PostStatus.DRAFT);
    });

    it('should reject publish for post with disconnected social account (422 UnprocessableEntity)', async () => {
      const postWithDisc = await createDraftPostWithMedia(
        'Disconnected account post',
        disconnectedAccountId,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postWithDisc}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(422);

      expect(res.body.message).toContain('not connected');
    });

    it('should reject publish if physical file is missing from storage (422 UnprocessableEntity)', async () => {
      const postId = await createDraftPostWithMedia('Missing storage post');
      const media = await prisma.media.findFirst({ where: { postId } });
      expect(media).not.toBeNull();

      // Delete physical file from disk
      const physicalPath = path.resolve(tempStorageRoot, media!.filePath);
      await fs.promises.unlink(physicalPath);

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(422);

      expect(res.body.message).toContain('does not exist in storage');
    });

    it('should successfully publish valid draft post (200 OK)', async () => {
      const postId = await createDraftPostWithMedia('Successful publish post');

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(res.body.post.publishedUrl).toContain('instagram.com');
      expect(res.body.post.publishedAt).toBeDefined();
      expect(res.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
      expect(res.body.attempt.errorMessage).toBeNull();

      // Verify no sensitive token in response
      expect(res.body.post.socialAccount).not.toHaveProperty('accessToken');
      expect(res.body.attempt).not.toHaveProperty('accessToken');

      // Verify database state
      const dbPost = await prisma.post.findUnique({ where: { id: postId } });
      expect(dbPost?.status).toBe(PostStatus.PUBLISHED);
      expect(dbPost?.publishedUrl).toContain('instagram.com');

      const dbAttempts = await prisma.publishAttempt.findMany({
        where: { postId },
      });
      expect(dbAttempts).toHaveLength(1);
      expect(dbAttempts[0].status).toBe(PublishAttemptStatus.SUCCESS);
    });

    it('should reject publishing an already PUBLISHED post (409 Conflict)', async () => {
      const postId = await createDraftPostWithMedia('Already published post');

      // Publish once
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // Attempt to publish again
      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(409);

      expect(res.body.message).toContain('already been published');
    });
  });

  describe('Failure & Retry Flow', () => {
    it('should record FAILED status on platform failure and allow retry', async () => {
      const postId = await createDraftPostWithMedia('Failed then retry post');

      // 1. Simulate failure in mock publisher
      mockInstagramAdapter.setFailure({
        message: 'Instagram Graph API error with EAAG_token',
        apiErrorCode: 'IG_API_ERROR',
        classification: 'RETRYABLE',
      });

      const failRes = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(failRes.body.post.status).toBe(PostStatus.FAILED);
      expect(failRes.body.attempt.status).toBe(PublishAttemptStatus.FAILED);
      expect(failRes.body.attempt.errorMessage).toContain('[REDACTED_TOKEN]');
      expect(failRes.body.attempt.apiErrorCode).toBe('IG_API_ERROR');

      // Verify DB state
      const dbPostFailed = await prisma.post.findUnique({ where: { id: postId } });
      expect(dbPostFailed?.status).toBe(PostStatus.FAILED);

      const firstAttempt = await prisma.publishAttempt.findFirst({
        where: { postId },
      });
      expect(firstAttempt?.status).toBe(PublishAttemptStatus.FAILED);

      // 2. Reject normal /publish on FAILED post (must use /retry)
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(409);

      // 3. Retry publishing with fixed adapter
      mockInstagramAdapter.setSuccess();

      const retryRes = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/retry`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(retryRes.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(retryRes.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);
      expect(retryRes.body.attempt.id).not.toBe(firstAttempt?.id);

      // Verify DB has exactly 2 attempts, and the first attempt was NOT overwritten
      const allAttempts = await prisma.publishAttempt.findMany({
        where: { postId },
        orderBy: { startedAt: 'asc' },
      });
      expect(allAttempts).toHaveLength(2);
      expect(allAttempts[0].status).toBe(PublishAttemptStatus.FAILED);
      expect(allAttempts[1].status).toBe(PublishAttemptStatus.SUCCESS);
    });

    it('should retrieve historical publish attempts via GET /api/posts/:id/attempts', async () => {
      const postId = await createDraftPostWithMedia('Attempts history post');

      // Publish success
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/posts/${postId}/attempts`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe(PublishAttemptStatus.SUCCESS);

      // User B cannot access User A attempts
      await request(app.getHttpServer())
        .get(`/api/posts/${postId}/attempts`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });
  });

  describe('CONCURRENT PUBLISH TEST (Race Condition Prevention)', () => {
    it('should prevent duplicate publishing when two requests arrive simultaneously', async () => {
      const concurrentPostId = await createDraftPostWithMedia(
        'Concurrent Race Condition Post',
      );

      mockInstagramAdapter.reset();

      // Launch two concurrent publish requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/posts/${concurrentPostId}/publish`)
          .set('Authorization', `Bearer ${userAToken}`),
        request(app.getHttpServer())
          .post(`/api/posts/${concurrentPostId}/publish`)
          .set('Authorization', `Bearer ${userAToken}`),
      ]);

      const statusCodes = [res1.status, res2.status].sort();

      // Exactly ONE request must succeed (200 OK) and exactly ONE must receive Conflict (409 Conflict)
      expect(statusCodes).toEqual([200, 409]);

      // Verify the winning request got valid published data
      const successRes = res1.status === 200 ? res1 : res2;
      expect(successRes.body.post.status).toBe(PostStatus.PUBLISHED);
      expect(successRes.body.attempt.status).toBe(PublishAttemptStatus.SUCCESS);

      // Verify database state: Post is PUBLISHED and exactly 1 attempt exists
      const dbPost = await prisma.post.findUnique({
        where: { id: concurrentPostId },
      });
      expect(dbPost?.status).toBe(PostStatus.PUBLISHED);

      const dbAttempts = await prisma.publishAttempt.findMany({
        where: { postId: concurrentPostId },
      });
      expect(dbAttempts).toHaveLength(1);
      expect(dbAttempts[0].status).toBe(PublishAttemptStatus.SUCCESS);

      // Verify mock publisher was called exactly ONCE
      expect(mockInstagramAdapter.getCallCount()).toBe(1);
    });
  });
});
