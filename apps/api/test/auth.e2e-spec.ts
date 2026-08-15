import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testUsername = `testuser_${Date.now()}`;
  const testPassword = 'Password123!';

  let accessToken: string;
  let refreshTokenCookie: string;

  function getCookies(res: request.Response): string[] {
    const header = res.headers['set-cookie'];
    if (!header) return [];
    return Array.isArray(header) ? header : [header as string];
  }

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
  });

  afterAll(async () => {
    // Cleanup created test user
    try {
      await prisma.user.deleteMany({
        where: { username: { startsWith: 'testuser_' } },
      });
    } catch {
      // Ignore cleanup error if already removed
    }
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should reject registration with missing or short password (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: 'validuser', password: '123' })
        .expect(400);
    });

    it('should register a new user successfully (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: testUsername, password: testPassword })
        .expect(201);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('username', testUsername);
      expect(res.body.user).toHaveProperty('createdAt');
      expect(res.body.user).toHaveProperty('updatedAt');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('hashedRefreshToken');
      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');

      // Check cookie header
      const cookies = getCookies(res);
      expect(cookies.some((c) => c.includes('refreshToken='))).toBe(true);
    });

    it('should reject duplicate username with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: testUsername, password: testPassword })
        .expect(409);

      expect(res.body).toHaveProperty('message', 'Username is already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject login with wrong password (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: testUsername, password: 'WrongPassword999!' })
        .expect(401);

      expect(res.body).toHaveProperty('message', 'Invalid username or password');
    });

    it('should reject login for non-existent user (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user_999', password: 'Password123!' })
        .expect(401);

      expect(res.body).toHaveProperty('message', 'Invalid username or password');
    });

    it('should login successfully with valid credentials (200)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: testUsername, password: testPassword })
        .expect(200);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe(testUsername);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('hashedRefreshToken');
      expect(res.body).toHaveProperty('accessToken');

      accessToken = res.body.accessToken;

      const cookies = getCookies(res);
      const cookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(cookie).toBeDefined();
      refreshTokenCookie = cookie!.split(';')[0];
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload')
        .expect(401);
    });

    it('should return authenticated user profile with valid Bearer token (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toBe(testUsername);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('hashedRefreshToken');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let newAccessToken: string;
    let newRefreshTokenCookie: string;

    it('should refresh access token using valid refresh token cookie (200)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshTokenCookie])
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      newAccessToken = res.body.accessToken;

      // Check rotated refresh token cookie
      const cookies = getCookies(res);
      const cookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(cookie).toBeDefined();
      newRefreshTokenCookie = cookie!.split(';')[0];
    });

    it('should be able to access /api/auth/me with newly issued access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(res.body.username).toBe(testUsername);
    });

    it('should reject refresh when previous refresh token is reused after rotation (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshTokenCookie])
        .expect(401);

      // Update pointer to new token for subsequent tests
      refreshTokenCookie = newRefreshTokenCookie;
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout, clear cookie, and revoke refresh token (200)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', [refreshTokenCookie])
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      // Cookie should be cleared
      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
    });

    it('should reject refresh token after logout (revoked) (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshTokenCookie])
        .expect(401);
    });
  });
});
