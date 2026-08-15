import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Platform } from '../generated/prisma/client';

describe('Instagram OAuth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = {
    username: `ig_user_a_${Date.now()}`,
    password: 'Password123!',
  };
  let userAId: string;
  let userAToken: string;

  const userB = {
    username: `ig_user_b_${Date.now()}`,
    password: 'Password123!',
  };
  let userBId: string;
  let userBToken: string;

  const mockInstagramId = `178414000000000${Math.floor(Math.random() * 1000)}`;
  const mockIgUsername = 'ig_creator_e2e';

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

  describe('GET /api/social-accounts/instagram/connect', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/social-accounts/instagram/connect')
        .expect(401);
    });

    it('should return authorization URL with valid state bound to Platform.INSTAGRAM for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts/instagram/connect')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toContain('https://www.instagram.com/oauth/authorize');

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
      expect(dbState!.platform).toBe(Platform.INSTAGRAM);
      expect(dbState!.consumedAt).toBeNull();
    });
  });

  describe('GET /api/social-accounts/instagram/callback', () => {
    it('should redirect to error URL when user denies Instagram authorization', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts/instagram/callback')
        .query({
          error: 'access_denied',
          error_reason: 'user_denied',
          error_description: 'Permissions were not granted',
        })
        .expect(302);

      const location = res.headers['location'];
      expect(location).toContain('status=error');
      expect(location).toContain('access_denied');
    });

    it('should redirect to error URL when invalid state is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/social-accounts/instagram/callback')
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
        .get('/api/social-accounts/instagram/connect')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const parsedUrl = new URL(connectRes.body.url);
      const validState = parsedUrl.searchParams.get('state')!;

      // 2. Mock external Instagram fetch calls
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/oauth/access_token')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'IGQ_short_lived_token_e2e_123',
              user_id: mockInstagramId,
              permissions: ['instagram_business_basic'],
            }),
          };
        }
        if (urlStr.includes('/access_token')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'IGQ_long_lived_token_e2e_456',
              token_type: 'bearer',
              expires_in: 5184000,
            }),
          };
        }
        if (urlStr.includes('/me')) {
          return {
            ok: true,
            json: async () => ({
              id: mockInstagramId,
              username: mockIgUsername,
              name: 'Instagram E2E Business',
              account_type: 'BUSINESS',
              profile_picture_url: 'https://example.com/ig_avatar.jpg',
            }),
          };
        }
        return originalFetch(url as any);
      }) as any;

      try {
        // 3. Trigger callback with valid code and state
        const callbackRes = await request(app.getHttpServer())
          .get('/api/social-accounts/instagram/callback')
          .query({
            code: 'e2e_ig_auth_code_789',
            state: validState,
          })
          .expect(302);

        const location = callbackRes.headers['location'];
        expect(location).toContain('status=success');
        expect(location).toContain('platform=instagram');
        expect(location).toContain('accountId=');

        // 4. Verify User A can fetch the connected account via GET /api/social-accounts
        const listRes = await request(app.getHttpServer())
          .get('/api/social-accounts')
          .set('Authorization', `Bearer ${userAToken}`)
          .expect(200);

        expect(Array.isArray(listRes.body)).toBe(true);
        expect(listRes.body.length).toBeGreaterThanOrEqual(1);

        const igAccount = listRes.body.find(
          (acc: any) => acc.platformAccountId === mockInstagramId,
        );
        expect(igAccount).toBeDefined();
        expect(igAccount.platform).toBe(Platform.INSTAGRAM);
        expect(igAccount.username).toBe(mockIgUsername);
        expect(igAccount.profileImageUrl).toBe('https://example.com/ig_avatar.jpg');
        expect(igAccount.connectionStatus).toBe('CONNECTED');

        // Verify tokens are never exposed in API response
        expect(igAccount).not.toHaveProperty('accessToken');
        expect(igAccount).not.toHaveProperty('refreshToken');

        // 5. Verify User B does not see User A's connected account
        const userBList = await request(app.getHttpServer())
          .get('/api/social-accounts')
          .set('Authorization', `Bearer ${userBToken}`)
          .expect(200);

        expect(
          userBList.body.some(
            (acc: any) => acc.platformAccountId === mockInstagramId,
          ),
        ).toBe(false);

        // 6. Test state replay: repeating callback with the same state should fail (consumed)
        const replayRes = await request(app.getHttpServer())
          .get('/api/social-accounts/instagram/callback')
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
