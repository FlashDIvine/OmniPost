import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { hash } from '@node-rs/argon2';
import { User } from '../../generated/prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockDate = new Date('2026-08-15T00:00:00.000Z');
  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    passwordHash: '',
    hashedRefreshToken: null,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(async () => {
    // Generate a real argon2 hash for testing password verification
    const validPasswordHash = await hash('Password123!');
    mockUser.passwordHash = validPasswordHash;
    mockUser.hashedRefreshToken = null;

    const mockUsersService = {
      findByUsername: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateHashedRefreshToken: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn().mockImplementation((payload) => {
        if (payload.username) return Promise.resolve('mock-access-token');
        return Promise.resolve('mock-refresh-token');
      }),
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const configMap: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret-32-chars-long-key',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-long-key',
          JWT_REFRESH_EXPIRES_IN: '7d',
          NODE_ENV: 'test',
        };
        return configMap[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user, hash password with argon2, and return tokens', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.updateHashedRefreshToken.mockResolvedValue(mockUser);

      const result = await service.register({
        username: 'testuser',
        password: 'Password123!',
      });

      expect(usersService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          passwordHash: expect.stringMatching(/^\$argon2/),
        }),
      );
      expect(usersService.updateHashedRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.stringMatching(/^\$argon2/),
      );
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('hashedRefreshToken');
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken', 'mock-refresh-token');
    });

    it('should throw ConflictException if username is already taken', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.register({
          username: 'testuser',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials and return tokens', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);
      usersService.updateHashedRefreshToken.mockResolvedValue(mockUser);

      const result = await service.login({
        username: 'testuser',
        password: 'Password123!',
      });

      expect(result.user).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(usersService.updateHashedRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.stringMatching(/^\$argon2/),
      );
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({
          username: 'nonexistent',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.login({
          username: 'testuser',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should verify refresh token, rotate tokens, and update database hash', async () => {
      const validRefreshHash = await hash('valid-refresh-token');
      const userWithRefresh: User = {
        ...mockUser,
        hashedRefreshToken: validRefreshHash,
      };

      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      usersService.findById.mockResolvedValue(userWithRefresh);
      usersService.updateHashedRefreshToken.mockResolvedValue(userWithRefresh);

      const result = await service.refreshToken('valid-refresh-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.objectContaining({
          secret: 'test-refresh-secret-32-chars-long-key',
        }),
      );
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(usersService.updateHashedRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.stringMatching(/^\$argon2/),
      );
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken', 'mock-refresh-token');
    });

    it('should throw UnauthorizedException if no token is provided', async () => {
      await expect(service.refreshToken('')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token is expired or invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user has no stored refresh token (revoked)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      usersService.findById.mockResolvedValue({
        ...mockUser,
        hashedRefreshToken: null,
      });

      await expect(
        service.refreshToken('some-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token hash does not match', async () => {
      const differentHash = await hash('other-token');
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      usersService.findById.mockResolvedValue({
        ...mockUser,
        hashedRefreshToken: differentHash,
      });

      await expect(
        service.refreshToken('mismatched-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should set hashedRefreshToken to null when userId is provided', async () => {
      usersService.updateHashedRefreshToken.mockResolvedValue(mockUser);

      const result = await service.logout(mockUser.id);

      expect(usersService.updateHashedRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        null,
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should return success message even if no userId provided', async () => {
      const result = await service.logout(undefined);
      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(usersService.updateHashedRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return sanitized user profile without sensitive fields', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.getMe(mockUser.id);

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('hashedRefreshToken');
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getMe('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
