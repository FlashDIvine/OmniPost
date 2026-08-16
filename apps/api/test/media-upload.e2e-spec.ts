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
import { MediaType, Platform, PostStatus } from '../generated/prisma/client';

describe('MediaUpload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;
  let storageService: StorageService;
  let tempStorageRoot: string;

  const userA = {
    username: `media_user_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `media_user_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  let accountAId: string;
  let postAId: string;
  let mediaA1Id: string;
  let mediaA1Path: string;
  let mediaA2Id: string;
  let mediaA2Path: string;

  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48,
  ]);

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);

  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20,
  ]);

  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00,
  ]);

  beforeAll(async () => {
    // Setup isolated temp storage root for this E2E test suite
    tempStorageRoot = path.join(
      os.tmpdir(),
      `omnipost-e2e-media-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

    // 3. Connect social account for User A
    const accA = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.INSTAGRAM,
      platformAccountId: `ig_upload_${Date.now()}`,
      username: 'alice_media_uploader',
      accessToken: 'EAAG_test_token_secret',
      profileImageUrl: 'https://example.com/alice.jpg',
      tokenExpiry: new Date('2026-12-31T00:00:00.000Z'),
    });
    accountAId = accA.id;

    // 4. Create a draft Post for User A
    const postRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        caption: 'Post with uploaded media files',
        socialAccountId: accountAId,
      })
      .expect(201);
    postAId = postRes.body.id;
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
      await fs.promises.rm(tempStorageRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('POST /api/posts/:id/media (Multipart Upload)', () => {
    it('should reject unauthenticated upload (401)', async () => {
      await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .attach('file', validJpegBuffer, 'photo.jpg')
        .expect(401);
    });

    it('should reject upload to another user post (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userBToken}`)
        .attach('file', validJpegBuffer, 'photo.jpg')
        .expect(404);
    });

    it('should reject upload without file attached (400 BadRequest)', async () => {
      await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(400);
    });

    it('should reject upload with fake binary disguised with .jpg extension (400 BadRequest)', async () => {
      const fakeBuffer = Buffer.from('this is plain text content not an image');
      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', fakeBuffer, 'fake.jpg')
        .expect(400);

      expect(res.body.message).toContain('Unsupported file format');
    });

    it('should reject MIME spoofing when declared MIME does not match magic bytes (400 BadRequest)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validJpegBuffer, {
          filename: 'photo.png',
          contentType: 'image/png', // Spoofed PNG header on JPEG file
        })
        .expect(400);

      expect(res.body.message).toContain('MIME spoofing detected');
    });

    it('should safely upload a valid JPEG file and store it under a generated UUID key (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validJpegBuffer, 'beach_sunset.jpg')
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      mediaA1Id = res.body.id;
      mediaA1Path = res.body.filePath;

      expect(res.body.postId).toBe(postAId);
      expect(res.body.mediaType).toBe(MediaType.IMAGE);
      expect(res.body.mimeType).toBe('image/jpeg');
      expect(res.body.fileName).toBe('beach_sunset.jpg');
      expect(res.body.sortOrder).toBe(0);

      // Verify key format
      expect(mediaA1Path).toMatch(
        new RegExp(`^users/${userAId}/posts/${postAId}/[a-f0-9-]+\\.jpg$`),
      );

      // Verify physical file exists in isolated temp storage root
      const fullPhysicalPath = path.resolve(tempStorageRoot, mediaA1Path);
      expect(fs.existsSync(fullPhysicalPath)).toBe(true);
      const savedBytes = await fs.promises.readFile(fullPhysicalPath);
      expect(savedBytes).toEqual(validJpegBuffer);
    });

    it('should safely upload PNG, WebP, and MP4 media files (201 Created)', async () => {
      // Upload PNG
      const pngRes = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validPngBuffer, 'diagram.png')
        .expect(201);

      expect(pngRes.body.mediaType).toBe(MediaType.IMAGE);
      expect(pngRes.body.mimeType).toBe('image/png');
      expect(pngRes.body.sortOrder).toBe(1);
      mediaA2Id = pngRes.body.id;
      mediaA2Path = pngRes.body.filePath;

      // Upload WebP
      const webpRes = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validWebpBuffer, 'banner.webp')
        .expect(201);

      expect(webpRes.body.mediaType).toBe(MediaType.IMAGE);
      expect(webpRes.body.mimeType).toBe('image/webp');
      expect(webpRes.body.sortOrder).toBe(2);

      // Upload MP4
      const mp4Res = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validMp4Buffer, 'teaser.mp4')
        .expect(201);

      expect(mp4Res.body.mediaType).toBe(MediaType.VIDEO);
      expect(mp4Res.body.mimeType).toBe('video/mp4');
      expect(mp4Res.body.sortOrder).toBe(3);
    });

    it('should protect against path traversal in uploaded filename', async () => {
      const traversalRes = await request(app.getHttpServer())
        .post(`/api/posts/${postAId}/media`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validJpegBuffer, '../../../../traversal.jpg')
        .expect(201);

      // Sanitized filename
      expect(traversalRes.body.fileName).toBe('traversal.jpg');
      // Storage key remains properly scoped
      expect(traversalRes.body.filePath).toMatch(
        new RegExp(`^users/${userAId}/posts/${postAId}/[a-f0-9-]+\\.jpg$`),
      );
      const physicalPath = path.resolve(
        tempStorageRoot,
        traversalRes.body.filePath,
      );
      expect(fs.existsSync(physicalPath)).toBe(true);
    });
  });

  describe('GET /api/posts/:postId/media/:mediaId (Authenticated Stream)', () => {
    it('should reject unauthenticated media retrieval (401)', async () => {
      await request(app.getHttpServer())
        .get(`/api/posts/${postAId}/media/${mediaA1Id}`)
        .expect(401);
    });

    it('should reject User B attempting to download User A media (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .get(`/api/posts/${postAId}/media/${mediaA1Id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('should allow User A to stream own media with correct content headers (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/posts/${postAId}/media/${mediaA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(parseInt(res.headers['content-length'], 10)).toBe(
        validJpegBuffer.length,
      );
      expect(res.body).toEqual(validJpegBuffer);
    });

    it('should return 404 for non-existent media UUID', async () => {
      await request(app.getHttpServer())
        .get(`/api/posts/${postAId}/media/550e8400-e29b-41d4-a716-446655440000`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/posts/:postId/media/:mediaId', () => {
    it('should reject unauthenticated delete (401)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}/media/${mediaA1Id}`)
        .expect(401);
    });

    it('should reject User B attempting to delete User A media (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}/media/${mediaA1Id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);

      // Verify physical file still exists
      const physicalPath = path.resolve(tempStorageRoot, mediaA1Path);
      expect(fs.existsSync(physicalPath)).toBe(true);
    });

    it('should allow User A to delete media, removing both DB record and physical file (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}/media/${mediaA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'Media deleted successfully' });

      // Verify database record is deleted
      const dbMedia = await prisma.media.findUnique({
        where: { id: mediaA1Id },
      });
      expect(dbMedia).toBeNull();

      // Verify physical file is deleted from disk
      const physicalPath = path.resolve(tempStorageRoot, mediaA1Path);
      expect(fs.existsSync(physicalPath)).toBe(false);
    });
  });

  describe('DELETE /api/posts/:id (Post Deletion with Physical Media Cleanup)', () => {
    it('should clean up all remaining physical media files when post is deleted', async () => {
      const physicalMedia2 = path.resolve(tempStorageRoot, mediaA2Path);
      expect(fs.existsSync(physicalMedia2)).toBe(true);

      const res = await request(app.getHttpServer())
        .delete(`/api/posts/${postAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'Post deleted successfully' });

      // Verify post and media are deleted in database
      const dbPost = await prisma.post.findUnique({
        where: { id: postAId },
      });
      expect(dbPost).toBeNull();

      const remainingMedia = await prisma.media.findMany({
        where: { postId: postAId },
      });
      expect(remainingMedia).toHaveLength(0);

      // Verify physical file was deleted from disk
      expect(fs.existsSync(physicalMedia2)).toBe(false);
    });
  });
});
