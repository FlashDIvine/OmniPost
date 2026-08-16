import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SocialAccountsService } from '../src/social-accounts/social-accounts.service';
import { MediaType, Platform, PostStatus } from '../generated/prisma/client';

describe('PostsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;

  const userA = {
    username: `post_user_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `post_user_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  let accountAId: string;
  let accountBId: string;
  let postAId: string;

  beforeAll(async () => {
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

    // 1. Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userA)
      .expect(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.accessToken;

    // 2. Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userB)
      .expect(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.accessToken;

    // 3. Connect Social Account for User A
    const accA = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.INSTAGRAM,
      platformAccountId: `ig_post_${Date.now()}_a`,
      username: 'alice_posts_ig',
      accessToken: 'EAAG_test_instagram_token_secret_a',
      profileImageUrl: 'https://example.com/alice.jpg',
      tokenExpiry: new Date('2026-12-31T00:00:00.000Z'),
    });
    accountAId = accA.id;

    // 4. Connect Social Account for User B
    const accB = await socialAccountsService.connectAccount(userBId, {
      platform: Platform.TIKTOK,
      platformAccountId: `tt_post_${Date.now()}_b`,
      username: 'bob_posts_tt',
      accessToken: 'act.test_tiktok_token_secret_b',
      profileImageUrl: 'https://example.com/bob.jpg',
      tokenExpiry: null,
    });
    accountBId = accB.id;
  }, 30000);

  afterAll(async () => {
    try {
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
    } catch {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('POST /api/posts', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/posts')
        .send({
          caption: 'Unauthenticated post',
          socialAccountId: accountAId,
        })
        .expect(401);
    });

    it('should reject creating post targeting another user social account (404 NotFound)', async () => {
      // User A tries to create a post targeting User B's social account
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          caption: 'Attempt to hijack Bob account',
          socialAccountId: accountBId,
        })
        .expect(404);
    });

    it('should reject invalid DTO payload (400 BadRequest)', async () => {
      // Invalid non-UUID socialAccountId
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          caption: 'Invalid post',
          socialAccountId: 'not-a-uuid',
        })
        .expect(400);

      // Invalid mediaType
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          caption: 'Invalid media type post',
          socialAccountId: accountAId,
          media: [
            {
              mediaType: 'AUDIO', // Not supported
              fileName: 'audio.mp3',
              filePath: 'uploads/audio.mp3',
              fileSize: 1024,
              mimeType: 'audio/mp3',
            },
          ],
        })
        .expect(400);
    });

    it('should create a post with own social account and multiple media items (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          caption: 'Exciting launch announcement! #OmniPost #MultiPlatform',
          socialAccountId: accountAId,
          cover: 'uploads/2026/08/launch_cover.jpg',
          media: [
            {
              mediaType: MediaType.IMAGE,
              fileName: 'launch_banner.jpg',
              filePath: 'uploads/2026/08/launch_banner.jpg',
              fileSize: 2048576,
              mimeType: 'image/jpeg',
              sortOrder: 0,
            },
            {
              mediaType: MediaType.VIDEO,
              fileName: 'teaser_video.mp4',
              filePath: 'uploads/2026/08/teaser_video.mp4',
              fileSize: 15728640,
              mimeType: 'video/mp4',
              sortOrder: 1,
            },
          ],
        })
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      postAId = res.body.id;

      expect(res.body.caption).toBe(
        'Exciting launch announcement! #OmniPost #MultiPlatform',
      );
      expect(res.body.status).toBe(PostStatus.DRAFT);
      expect(res.body.cover).toBe('uploads/2026/08/launch_cover.jpg');
      expect(res.body.publishedUrl).toBeNull();
      expect(res.body.publishedAt).toBeNull();
      expect(res.body.socialAccountId).toBe(accountAId);

      // Verify sanitized social account response (no token leak)
      expect(res.body.socialAccount).toBeDefined();
      expect(res.body.socialAccount.id).toBe(accountAId);
      expect(res.body.socialAccount.username).toBe('alice_posts_ig');
      expect(res.body.socialAccount.platform).toBe(Platform.INSTAGRAM);
      expect(res.body.socialAccount).not.toHaveProperty('accessToken');
      expect(res.body.socialAccount).not.toHaveProperty('refreshToken');

      // Verify media items
      expect(Array.isArray(res.body.media)).toBe(true);
      expect(res.body.media).toHaveLength(2);
      expect(res.body.media[0].mediaType).toBe(MediaType.IMAGE);
      expect(res.body.media[0].fileName).toBe('launch_banner.jpg');
      expect(res.body.media[0].sortOrder).toBe(0);
      expect(res.body.media[1].mediaType).toBe(MediaType.VIDEO);
      expect(res.body.media[1].fileName).toBe('teaser_video.mp4');
      expect(res.body.media[1].sortOrder).toBe(1);
    });
  });

  describe('GET /api/posts', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer()).get('/api/posts').expect(401);
    });

    it('should return paginated list of posts for User A (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/posts?page=1&limit=10')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(postAId);

      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.totalItems).toBe(1);
      expect(res.body.meta.totalPages).toBe(1);
      expect(res.body.meta.hasNextPage).toBe(false);
      expect(res.body.meta.hasPreviousPage).toBe(false);
    });

    it('should return empty list for User B who has not created any posts (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/posts')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.totalItems).toBe(0);
      expect(res.body.meta.totalPages).toBe(1);
    });

    it('should filter posts by status (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/posts?status=DRAFT')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);

      const publishedRes = await request(app.getHttpServer())
        .get('/api/posts?status=PUBLISHED')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(publishedRes.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/posts/:id', () => {
    it('should return post details for owner User A (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(postAId);
      expect(res.body.caption).toBe(
        'Exciting launch announcement! #OmniPost #MultiPlatform',
      );
      expect(res.body.socialAccount.username).toBe('alice_posts_ig');
      expect(res.body.media).toHaveLength(2);
    });

    it('should reject User B attempting to view User A post (404 NotFound - IDOR protection)', async () => {
      await request(app.getHttpServer())
        .get(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent post UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/posts/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/posts/invalid-id')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/posts/:id', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/posts/${postAId}`)
        .send({ caption: 'New caption' })
        .expect(401);
    });

    it('should reject User B attempting to update User A post (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ caption: 'Hacked caption' })
        .expect(404);
    });

    it('should reject User A attempting to change target social account to User B account (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ socialAccountId: accountBId })
        .expect(404);
    });

    it('should reject client attempting to force status to PUBLISHED (400 BadRequest)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(400);
    });

    it('should allow User A to update post caption, cover, and media (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          caption: 'Updated launch caption! #OmniPost #V2',
          cover: 'uploads/2026/08/updated_cover.jpg',
          media: [
            {
              mediaType: MediaType.IMAGE,
              fileName: 'updated_photo.jpg',
              filePath: 'uploads/2026/08/updated_photo.jpg',
              fileSize: 3145728,
              mimeType: 'image/jpeg',
              sortOrder: 0,
            },
          ],
        })
        .expect(200);

      expect(res.body.id).toBe(postAId);
      expect(res.body.caption).toBe(
        'Updated launch caption! #OmniPost #V2',
      );
      expect(res.body.cover).toBe('uploads/2026/08/updated_cover.jpg');
      expect(res.body.media).toHaveLength(1);
      expect(res.body.media[0].fileName).toBe('updated_photo.jpg');
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}`)
        .expect(401);
    });

    it('should reject User B attempting to delete User A post (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('should allow User A to delete own post (200 OK) and cascade delete media', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toEqual({
        message: 'Post deleted successfully',
      });

      // Verify post is no longer retrievable
      await request(app.getHttpServer())
        .get(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);

      // Verify media records are cascade deleted in database
      const remainingMedia = await prisma.media.findMany({
        where: { postId: postAId },
      });
      expect(remainingMedia).toHaveLength(0);
    });
  });
});
