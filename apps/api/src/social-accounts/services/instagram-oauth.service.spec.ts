import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InstagramOAuthService } from './instagram-oauth.service';
import { OAuthStateService } from './oauth-state.service';
import { InstagramAdapter } from '../adapters/instagram.adapter';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConnectionStatus, Platform } from '../../../generated/prisma/client';

describe('InstagramOAuthService', () => {
  let service: InstagramOAuthService;
  let oAuthStateService: jest.Mocked<OAuthStateService>;
  let instagramAdapter: jest.Mocked<InstagramAdapter>;
  let prisma: jest.Mocked<PrismaService>;
  let cryptoService: jest.Mocked<CryptoService>;

  const userId1 = 'user-uuid-1';
  const userId2 = 'user-uuid-2';
  const mockState = 'mock_ig_state_12345';
  const mockCode = 'mock_ig_auth_code_67890';

  const mockTokenResponse = {
    accessToken: 'IGQ_real_long_lived_token_123',
    userId: '17841400000000001',
    expiresIn: 5184000,
    permissions: ['instagram_business_basic'],
  };

  const mockProfile = {
    platformAccountId: '17841400000000001',
    username: 'my_ig_business',
    profileImageUrl: 'https://example.com/avatar.jpg',
    accountType: 'BUSINESS',
    name: 'My IG Business',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'OAUTH_SUCCESS_REDIRECT')
          return 'http://localhost:3000/social-accounts?status=success';
        if (key === 'OAUTH_ERROR_REDIRECT')
          return 'http://localhost:3000/social-accounts?status=error';
        return null;
      }),
    };

    const mockOAuthStateService = {
      generateState: jest.fn().mockResolvedValue(mockState),
      validateAndConsumeState: jest.fn().mockResolvedValue({ userId: userId1 }),
    };

    const mockInstagramAdapter = {
      platform: Platform.INSTAGRAM,
      buildAuthorizationUrl: jest
        .fn()
        .mockReturnValue(
          `https://www.instagram.com/oauth/authorize?client_id=123&state=${mockState}`,
        ),
      exchangeCode: jest.fn().mockResolvedValue(mockTokenResponse),
      getProfile: jest.fn().mockResolvedValue(mockProfile),
      refreshToken: jest.fn(),
    };

    const mockPrisma = {
      socialAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockCrypto = {
      encrypt: jest.fn().mockImplementation((val) => `v1:enc:${val}`),
      decrypt: jest.fn().mockImplementation((val) => val.replace('v1:enc:', '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramOAuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OAuthStateService, useValue: mockOAuthStateService },
        { provide: InstagramAdapter, useValue: mockInstagramAdapter },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<InstagramOAuthService>(InstagramOAuthService);
    oAuthStateService = module.get(OAuthStateService);
    instagramAdapter = module.get(InstagramAdapter);
    prisma = module.get(PrismaService);
    cryptoService = module.get(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConnectUrl', () => {
    it('should generate secure state bound to Platform.INSTAGRAM and return authorization URL', async () => {
      const result = await service.getConnectUrl(userId1);

      expect(oAuthStateService.generateState).toHaveBeenCalledWith(
        userId1,
        Platform.INSTAGRAM,
      );
      expect(instagramAdapter.buildAuthorizationUrl).toHaveBeenCalledWith(mockState);
      expect(result.url).toContain('https://www.instagram.com/oauth/authorize');
    });
  });

  describe('handleCallback', () => {
    it('should redirect to error URL if Meta returned an OAuth error or denial', async () => {
      const result = await service.handleCallback({
        error: 'access_denied',
        error_reason: 'user_denied',
        error_description: 'Permissions were not granted',
        state: mockState,
      });

      expect(result.redirectUrl).toContain('status=error');
      expect(result.redirectUrl).toContain('error=access_denied');
    });

    it('should redirect to error URL if code or state is missing', async () => {
      const result = await service.handleCallback({
        code: undefined,
        state: undefined,
      });

      expect(result.redirectUrl).toContain('status=error');
      expect(result.redirectUrl).toContain('missing_parameters');
    });

    it('should successfully handle callback, exchange tokens, encrypt, and create new SocialAccount', async () => {
      (prisma.socialAccount.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.socialAccount.create as jest.Mock).mockResolvedValue({
        id: 'new-ig-account-uuid-1',
        platform: Platform.INSTAGRAM,
        platformAccountId: mockProfile.platformAccountId,
        username: mockProfile.username,
        profileImageUrl: mockProfile.profileImageUrl,
        accessToken: 'v1:enc:IGQ_real_long_lived_token_123',
        tokenExpiry: new Date(Date.now() + 5184000 * 1000),
        connectionStatus: ConnectionStatus.CONNECTED,
        userId: userId1,
      });

      const result = await service.handleCallback({
        code: mockCode,
        state: mockState,
      });

      expect(oAuthStateService.validateAndConsumeState).toHaveBeenCalledWith(
        mockState,
        Platform.INSTAGRAM,
      );
      expect(instagramAdapter.exchangeCode).toHaveBeenCalledWith(mockCode);
      expect(instagramAdapter.getProfile).toHaveBeenCalledWith(
        mockTokenResponse.accessToken,
      );
      expect(cryptoService.encrypt).toHaveBeenCalledWith(
        mockTokenResponse.accessToken,
      );
      expect(prisma.socialAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: Platform.INSTAGRAM,
          platformAccountId: mockProfile.platformAccountId,
          username: mockProfile.username,
          profileImageUrl: mockProfile.profileImageUrl,
          accessToken: 'v1:enc:IGQ_real_long_lived_token_123',
          connectionStatus: ConnectionStatus.CONNECTED,
          userId: userId1,
        }),
      });

      expect(result.redirectUrl).toContain('status=success');
      expect(result.redirectUrl).toContain('platform=instagram');
      expect(result.redirectUrl).toContain('accountId=new-ig-account-uuid-1');
    });

    it('should reconnect and update existing account when reconnecting the same Instagram account for the same user', async () => {
      const existingAccount = {
        id: 'existing-ig-acc-uuid-1',
        platform: Platform.INSTAGRAM,
        platformAccountId: mockProfile.platformAccountId,
        userId: userId1,
      };

      (prisma.socialAccount.findUnique as jest.Mock).mockResolvedValue(existingAccount);
      (prisma.socialAccount.update as jest.Mock).mockResolvedValue({
        ...existingAccount,
        id: 'existing-ig-acc-uuid-1',
      });

      const result = await service.handleCallback({
        code: mockCode,
        state: mockState,
      });

      expect(prisma.socialAccount.update).toHaveBeenCalledWith({
        where: { id: existingAccount.id },
        data: expect.objectContaining({
          username: mockProfile.username,
          accessToken: 'v1:enc:IGQ_real_long_lived_token_123',
          connectionStatus: ConnectionStatus.CONNECTED,
        }),
      });
      expect(prisma.socialAccount.create).not.toHaveBeenCalled();
      expect(result.redirectUrl).toContain('accountId=existing-ig-acc-uuid-1');
    });

    it('should reject connection and redirect to error if the Instagram account is already linked to a different OmniPost user', async () => {
      const accountBelongingToAnotherUser = {
        id: 'existing-ig-acc-uuid-2',
        platform: Platform.INSTAGRAM,
        platformAccountId: mockProfile.platformAccountId,
        userId: userId2,
      };

      (prisma.socialAccount.findUnique as jest.Mock).mockResolvedValue(
        accountBelongingToAnotherUser,
      );

      const result = await service.handleCallback({
        code: mockCode,
        state: mockState,
      });

      expect(prisma.socialAccount.update).not.toHaveBeenCalled();
      expect(prisma.socialAccount.create).not.toHaveBeenCalled();
      expect(result.redirectUrl).toContain('status=error');
      expect(result.redirectUrl).toContain('account_already_connected_to_another_user');
    });

    it('should reject personal account and redirect to error if profile fetch throws error for personal account', async () => {
      (instagramAdapter.getProfile as jest.Mock).mockRejectedValue(
        new Error(
          'Only Instagram Professional accounts (Business or Creator) are supported. Personal accounts are not eligible.',
        ),
      );

      const result = await service.handleCallback({
        code: mockCode,
        state: mockState,
      });

      expect(prisma.socialAccount.create).not.toHaveBeenCalled();
      expect(result.redirectUrl).toContain('status=error');
      expect(decodeURIComponent(result.redirectUrl.replace(/\+/g, ' '))).toContain(
        'Only Instagram Professional accounts',
      );
    });
  });
});
