import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OAuthStateService } from './oauth-state.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '../../../generated/prisma/client';

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-uuid-123';
  const mockState = 'mock_oauth_state_hex_string_64_chars_long_1234567890abcdef1234567890';

  beforeEach(async () => {
    const mockPrisma = {
      oAuthState: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthStateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OAuthStateService>(OAuthStateService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateState', () => {
    it('should generate a 64-character hex state and save to database with 10-minute expiry', async () => {
      (prisma.oAuthState.create as jest.Mock).mockResolvedValue({
        id: 'state-uuid-1',
        state: mockState,
        platform: Platform.TIKTOK,
        userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const state = await service.generateState(userId, Platform.TIKTOK);

      expect(state).toHaveLength(64); // 32 bytes hex = 64 characters
      expect(prisma.oAuthState.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          state,
          platform: Platform.TIKTOK,
          userId,
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('validateAndConsumeState', () => {
    it('should validate and mark state as consumed (single-use) for valid state', async () => {
      const validRecord = {
        id: 'state-id-1',
        state: mockState,
        platform: Platform.TIKTOK,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min in future
        consumedAt: null,
      };

      (prisma.oAuthState.findUnique as jest.Mock).mockResolvedValue(validRecord);
      (prisma.oAuthState.update as jest.Mock).mockResolvedValue({
        ...validRecord,
        consumedAt: new Date(),
      });

      const result = await service.validateAndConsumeState(
        mockState,
        Platform.TIKTOK,
      );

      expect(prisma.oAuthState.findUnique).toHaveBeenCalledWith({
        where: { state: mockState },
      });
      expect(prisma.oAuthState.update).toHaveBeenCalledWith({
        where: { id: validRecord.id },
        data: { consumedAt: expect.any(Date) },
      });
      expect(result).toEqual({ userId });
    });

    it('should throw BadRequestException if state not found', async () => {
      (prisma.oAuthState.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateAndConsumeState('unknown_state', Platform.TIKTOK),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if platform mismatches', async () => {
      (prisma.oAuthState.findUnique as jest.Mock).mockResolvedValue({
        id: 'state-id-1',
        state: mockState,
        platform: Platform.INSTAGRAM, // Mismatched platform
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        consumedAt: null,
      });

      await expect(
        service.validateAndConsumeState(mockState, Platform.TIKTOK),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if state was already consumed (replay attack)', async () => {
      (prisma.oAuthState.findUnique as jest.Mock).mockResolvedValue({
        id: 'state-id-1',
        state: mockState,
        platform: Platform.TIKTOK,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        consumedAt: new Date(Date.now() - 1000), // Already consumed
      });

      await expect(
        service.validateAndConsumeState(mockState, Platform.TIKTOK),
      ).rejects.toThrow('OAuth state has already been used');
    });

    it('should throw BadRequestException if state has expired', async () => {
      (prisma.oAuthState.findUnique as jest.Mock).mockResolvedValue({
        id: 'state-id-1',
        state: mockState,
        platform: Platform.TIKTOK,
        userId,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        consumedAt: null,
      });

      await expect(
        service.validateAndConsumeState(mockState, Platform.TIKTOK),
      ).rejects.toThrow('OAuth state has expired');
    });
  });
});
