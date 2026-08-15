import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { ConnectionStatus, Platform, SocialAccount } from '../../generated/prisma/client';

describe('SocialAccountsService', () => {
  let service: SocialAccountsService;
  let prisma: jest.Mocked<PrismaService>;
  let cryptoService: jest.Mocked<CryptoService>;

  const userId1 = 'user-uuid-1';
  const userId2 = 'user-uuid-2';
  const mockDate = new Date('2026-08-16T00:00:00.000Z');

  const mockAccount1: SocialAccount = {
    id: 'account-uuid-1',
    platform: Platform.INSTAGRAM,
    platformAccountId: 'ig_12345',
    username: 'my_instagram_page',
    profileImageUrl: 'https://example.com/ig.jpg',
    accessToken: 'v1:encrypted_token_1',
    tokenExpiry: mockDate,
    connectionStatus: ConnectionStatus.CONNECTED,
    userId: userId1,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const mockAccount2: SocialAccount = {
    id: 'account-uuid-2',
    platform: Platform.TIKTOK,
    platformAccountId: 'tt_67890',
    username: 'my_tiktok_channel',
    profileImageUrl: null,
    accessToken: 'v1:encrypted_token_2',
    tokenExpiry: null,
    connectionStatus: ConnectionStatus.EXPIRED,
    userId: userId1,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(async () => {
    const mockPrisma = {
      socialAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockCrypto = {
      encrypt: jest.fn().mockImplementation((val) => `v1:enc:${val}`),
      decrypt: jest.fn().mockImplementation((val) => val.replace('v1:enc:', '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAccountsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<SocialAccountsService>(SocialAccountsService);
    prisma = module.get(PrismaService);
    cryptoService = module.get(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForUser', () => {
    it('should return sanitized social accounts list for the authenticated user', async () => {
      (prisma.socialAccount.findMany as jest.Mock).mockResolvedValue([
        mockAccount1,
        mockAccount2,
      ]);

      const results = await service.findAllForUser(userId1);

      expect(prisma.socialAccount.findMany).toHaveBeenCalledWith({
        where: { userId: userId1 },
        orderBy: { createdAt: 'desc' },
      });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: mockAccount1.id,
        platform: Platform.INSTAGRAM,
        platformAccountId: mockAccount1.platformAccountId,
        username: mockAccount1.username,
        profileImageUrl: mockAccount1.profileImageUrl,
        tokenExpiry: mockAccount1.tokenExpiry,
        connectionStatus: ConnectionStatus.CONNECTED,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      expect(results[0]).not.toHaveProperty('accessToken');
      expect(results[1]).not.toHaveProperty('accessToken');
      expect(results[1].tokenExpiry).toBeNull();
      expect(results[1].connectionStatus).toBe(ConnectionStatus.EXPIRED);
    });
  });

  describe('findOneForUser', () => {
    it('should return sanitized single account when owned by authenticated user', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(mockAccount1);

      const result = await service.findOneForUser(mockAccount1.id, userId1);

      expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount1.id, userId: userId1 },
      });
      expect(result.id).toBe(mockAccount1.id);
      expect(result.username).toBe(mockAccount1.username);
      expect(result).not.toHaveProperty('accessToken');
    });

    it('should throw NotFoundException if account belongs to another user or does not exist', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOneForUser(mockAccount1.id, userId2),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('disconnectForUser', () => {
    it('should delete social account when owned by authenticated user', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(mockAccount1);
      (prisma.socialAccount.delete as jest.Mock).mockResolvedValue(mockAccount1);

      const result = await service.disconnectForUser(mockAccount1.id, userId1);

      expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount1.id, userId: userId1 },
      });
      expect(prisma.socialAccount.delete).toHaveBeenCalledWith({
        where: { id: mockAccount1.id },
      });
      expect(result).toEqual({
        message: 'Social account disconnected successfully',
      });
    });

    it('should throw NotFoundException if trying to disconnect an account owned by another user', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.disconnectForUser(mockAccount1.id, userId2),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.socialAccount.delete).not.toHaveBeenCalled();
    });
  });

  describe('connectAccount', () => {
    it('should encrypt access token and create social account', async () => {
      (prisma.socialAccount.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.socialAccount.create as jest.Mock).mockResolvedValue(mockAccount1);

      const result = await service.connectAccount(userId1, {
        platform: Platform.INSTAGRAM,
        platformAccountId: 'ig_12345',
        username: 'my_instagram_page',
        accessToken: 'raw_plain_access_token',
        profileImageUrl: 'https://example.com/ig.jpg',
        tokenExpiry: mockDate,
      });

      expect(cryptoService.encrypt).toHaveBeenCalledWith('raw_plain_access_token');
      expect(prisma.socialAccount.create).toHaveBeenCalledWith({
        data: {
          platform: Platform.INSTAGRAM,
          platformAccountId: 'ig_12345',
          username: 'my_instagram_page',
          profileImageUrl: 'https://example.com/ig.jpg',
          accessToken: 'v1:enc:raw_plain_access_token',
          tokenExpiry: mockDate,
          connectionStatus: ConnectionStatus.CONNECTED,
          userId: userId1,
        },
      });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('should throw ConflictException if duplicate platform and platformAccountId exists', async () => {
      (prisma.socialAccount.findUnique as jest.Mock).mockResolvedValue(mockAccount1);

      await expect(
        service.connectAccount(userId1, {
          platform: Platform.INSTAGRAM,
          platformAccountId: 'ig_12345',
          username: 'my_instagram_page',
          accessToken: 'token',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.socialAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('getDecryptedAccessToken', () => {
    it('should decrypt stored access token for internal use with ownership verification', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue({
        ...mockAccount1,
        accessToken: 'v1:enc:my_real_token',
      });

      const token = await service.getDecryptedAccessToken(mockAccount1.id, userId1);

      expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount1.id, userId: userId1 },
      });
      expect(cryptoService.decrypt).toHaveBeenCalledWith('v1:enc:my_real_token');
      expect(token).toBe('my_real_token');
    });

    it('should throw NotFoundException if account not owned by requesting user', async () => {
      (prisma.socialAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getDecryptedAccessToken(mockAccount1.id, userId2),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
