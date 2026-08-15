import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SocialAccountsService } from '../src/social-accounts/social-accounts.service';
import { Platform } from '../generated/prisma/client';

describe('SocialAccountsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socialAccountsService: SocialAccountsService;

  const userA = {
    username: `usera_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `userb_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  let accountA1Id: string;
  let accountA2Id: string;

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

    // Register & Login User A
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userA)
      .expect(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.accessToken;

    // Register & Login User B
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userB)
      .expect(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.accessToken;

    // Create test social accounts for User A via service fixture
    const acc1 = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.INSTAGRAM,
      platformAccountId: `ig_${Date.now()}_1`,
      username: 'alice_instagram',
      accessToken: 'EAAG_test_instagram_token_secret_123',
      profileImageUrl: 'https://example.com/alice.jpg',
      tokenExpiry: new Date('2026-12-31T00:00:00.000Z'),
    });
    accountA1Id = acc1.id;

    const acc2 = await socialAccountsService.connectAccount(userAId, {
      platform: Platform.TIKTOK,
      platformAccountId: `tt_${Date.now()}_2`,
      username: 'alice_tiktok',
      accessToken: 'act.test_tiktok_token_secret_456',
      profileImageUrl: null,
      tokenExpiry: null,
    });
    accountA2Id = acc2.id;
  });

  afterAll(async () => {
    try {
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
      // Ignore cleanup error
    }
    await app.close();
  });

  describe('GET /api/social-accounts', () => {
    it('should reject request without Bearer token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/social-accounts')
        .expect(401);
    });

    it('should return all social accounts belonging to User A (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      // Verify sanitized fields
      const igAcc = res.body.find((a: any) => a.id === accountA1Id);
      expect(igAcc).toBeDefined();
      expect(igAcc.platform).toBe(Platform.INSTAGRAM);
      expect(igAcc.username).toBe('alice_instagram');
      expect(igAcc.profileImageUrl).toBe('https://example.com/alice.jpg');
      expect(igAcc.connectionStatus).toBe('CONNECTED');
      expect(igAcc).not.toHaveProperty('accessToken');

      const ttAcc = res.body.find((a: any) => a.id === accountA2Id);
      expect(ttAcc).toBeDefined();
      expect(ttAcc.platform).toBe(Platform.TIKTOK);
      expect(ttAcc.username).toBe('alice_tiktok');
      expect(ttAcc.profileImageUrl).toBeNull();
      expect(ttAcc).not.toHaveProperty('accessToken');
    });

    it('should return empty list for User B who has no social accounts (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/social-accounts/:id', () => {
    it('should return single social account details for User A (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/social-accounts/${accountA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(accountA1Id);
      expect(res.body.username).toBe('alice_instagram');
      expect(res.body.platform).toBe(Platform.INSTAGRAM);
      expect(res.body).not.toHaveProperty('accessToken');
    });

    it('should reject User B attempting to access User A account (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .get(`/api/social-accounts/${accountA1Id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent account ID', async () => {
      await request(app.getHttpServer())
        .get('/api/social-accounts/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/social-accounts/:id', () => {
    it('should reject User B attempting to delete User A account (404 NotFound)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/social-accounts/${accountA1Id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);

      // Verify account still exists for User A
      await request(app.getHttpServer())
        .get(`/api/social-accounts/${accountA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);
    });

    it('should allow User A to disconnect their own account (200)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/social-accounts/${accountA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toHaveProperty(
        'message',
        'Social account disconnected successfully',
      );

      // Verify account is removed
      await request(app.getHttpServer())
        .get(`/api/social-accounts/${accountA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);

      // User A should now only have 1 account left
      const listRes = await request(app.getHttpServer())
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(accountA2Id);
    });
  });
});
