import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Platform } from '../generated/prisma/client';

describe('TikTok OAuth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = {
    username: `tiktok_user_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `tiktok_user_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  const mockOpenId = `tt_open_id_${Date.now()}`;
  const mockTikTokUsername = 'tiktok_creator_e2e';

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

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userA)
      .expect(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.accessToken;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userB)
      .expect(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.accessToken;
  });

  afterAll(async () => {
    try {
      await prisma.oAuthState.deleteMany({
        where: { userId: { in: [userAId, userBId] } },
      });
      await prisma.socialAccount.deleteMany({
        where: { userId: { in: [userAId, userBId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
      });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  describe('GET /api/social-accounts/tiktok/connect', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/social-accounts/tiktok/connect')
        .expect(401);
    });

    it('should return authorization URL with valid state parameter for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts/tiktok/connect')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toContain('https://www.tiktok.com/v2/auth/authorize/');

      const parsedUrl = new URL(res.body.url);
      const state = parsedUrl.searchParams.get('state');
      expect(state).toBeDefined();
      expect(state!.length).toBe(64); // 32 bytes hex

      // Verify state was saved to database
      const dbState = await prisma.oAuthState.findUnique({
        where: { state: state! },
      });
      expect(dbState).toBeDefined();
      expect(dbState!.userId).toBe(userAId);
      expect(dbState!.platform).toBe(Platform.TIKTOK);
      expect(dbState!.consumedAt).toBeNull();
    });
  });

  describe('GET /api/social-accounts/tiktok/callback', () => {
    it('should redirect to error URL when user denies TikTok authorization', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts/tiktok/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied authorization',
        })
        .expect(302);

      const location = res.headers['location'];
      expect(location).toContain('status=error');
      expect(location).toContain('access_denied');
    });

    it('should redirect to error URL when invalid state is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts/tiktok/callback')
        .query({
          code: 'valid_looking_code',
          state: 'invalid_non_existent_state',
        })
        .expect(302);

      const location = res.headers['location'];
      expect(location).toContain('status=error');
    });

    it('should complete OAuth flow, create SocialAccount, and redirect to success URL', async () => {
      // 1. Generate real state via connect endpoint
      const connectRes = await request(app.getHttpServer())
        .get('/api/social-accounts/tiktok/connect')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const parsedUrl = new URL(connectRes.body.url);
      const validState = parsedUrl.searchParams.get('state')!;

      // 2. Mock external TikTok fetch calls
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/v2/oauth/token/')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                access_token: 'act.e2e_mock_access_token_123',
                expires_in: 86400,
                open_id: mockOpenId,
                refresh_token: 'rft.e2e_mock_refresh_token_456',
                refresh_expires_in: 31536000,
                scope: 'user.info.basic',
                token_type: 'Bearer',
              },
              error: { code: 'ok', message: '' },
            }),
          };
        }
        if (urlStr.includes('/v2/user/info/')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                user: {
                  open_id: mockOpenId,
                  union_id: `union_${mockOpenId}`,
                  avatar_url: 'https://p16.tiktokcdn.com/avatar.jpeg',
                  display_name: 'TikTok E2E User',
                  username: mockTikTokUsername,
                },
              },
              error: { code: 'ok', message: '' },
            }),
          };
        }
        return originalFetch(url as any);
      }) as any;

      try {
        // 3. Trigger callback with valid code and state
        const callbackRes = await request(app.getHttpServer())
          .get('/api/social-accounts/tiktok/callback')
          .query({
            code: 'e2e_auth_code_789',
            state: validState,
          })
          .expect(302);

        const location = callbackRes.headers['location'];
        expect(location).toContain('status=success');
        expect(location).toContain('platform=tiktok');
        expect(location).toContain('accountId=');

        // 4. Verify User A can fetch the connected account via GET /api/social-accounts
        const listRes = await request(app.getHttpServer())
          .get('/api/social-accounts')
          .set('Authorization', `Bearer ${userAToken}`)
          .expect(200);

        expect(Array.isArray(listRes.body)).toBe(true);
        expect(listRes.body.length).toBeGreaterThanOrEqual(1);

        const ttAccount = listRes.body.find(
          (acc: any) => acc.platformAccountId === mockOpenId,
        );
        expect(ttAccount).toBeDefined();
        expect(ttAccount.platform).toBe(Platform.TIKTOK);
        expect(ttAccount.username).toBe(mockTikTokUsername);
        expect(ttAccount.profileImageUrl).toBe('https://p16.tiktokcdn.com/avatar.jpeg');
        expect(ttAccount.connectionStatus).toBe('CONNECTED');

        // Verify tokens are never exposed in API response
        expect(ttAccount).not.toHaveProperty('accessToken');
        expect(ttAccount).not.toHaveProperty('refreshToken');

        // 5. Verify User B does not see User A's connected account
        const userBList = await request(app.getHttpServer())
          .get('/api/social-accounts')
          .set('Authorization', `Bearer ${userBToken}`)
          .expect(200);

        expect(
          userBList.body.some((acc: any) => acc.platformAccountId === mockOpenId),
        ).toBe(false);

        // 6. Test state replay: repeating callback with the same state should fail (consumed)
        const replayRes = await request(app.getHttpServer())
          .get('/api/social-accounts/tiktok/callback')
          .query({
            code: 'replay_code',
            state: validState,
          })
          .expect(302);

        expect(replayRes.headers['location']).toContain('status=error');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
