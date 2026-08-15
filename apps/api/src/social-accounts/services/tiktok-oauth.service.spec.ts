import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TikTokOAuthService } from './tiktok-oauth.service';
import { OAuthStateService } from './oauth-state.service';
import { TikTokAdapter } from '../adapters/tiktok.adapter';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConnectionStatus, Platform } from '../../../generated/prisma/client';

describe('TikTokOAuthService', () => {
  let service: TikTokOAuthService;
  let oAuthStateService: jest.Mocked<OAuthStateService>;
  let tikTokAdapter: jest.Mocked<TikTokAdapter>;
  let prisma: jest.Mocked<PrismaService>;
  let cryptoService: jest.Mocked<CryptoService>;

  const userId1 = 'user-uuid-1';
  const userId2 = 'user-uuid-2';
  const mockState = 'mock_state_12345';
  const mockCode = 'mock_auth_code_67890';

  const mockTokenResponse = {
    accessToken: 'act.real_tiktok_access_token',
    expiresIn: 86400,
    openId: 'open_id_tiktok_123',
    refreshToken: 'rft.real_tiktok_refresh_token',
    refreshExpiresIn: 31536000,
    scope: 'user.info.basic',
    tokenType: 'Bearer',
  };

  const mockProfile = {
    platformAccountId: 'open_id_tiktok_123',
    username: 'my_tiktok_handle',
    profileImageUrl: 'https://example.com/avatar.jpg',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'OAUTH_SUCCESS_REDIRECT') return 'http://localhost:3000/social-accounts?status=success';
        if (key === 'OAUTH_ERROR_REDIRECT') return 'http://localhost:3000/social-accounts?status=error';
        return null;
      }),
    };

    const mockOAuthStateService = {
      generateState: jest.fn().mockResolvedValue(mockState),
      validateAndConsumeState: jest.fn().mockResolvedValue({ userId: userId1 }),
    };

    const mockTikTokAdapter = {
      platform: Platform.TIKTOK,
      buildAuthorizationUrl: jest
        .fn()
        .mockReturnValue(`https://www.tiktok.com/v2/auth/authorize/?state=${mockState}`),
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
        TikTokOAuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OAuthStateService, useValue: mockOAuthStateService },
        { provide: TikTokAdapter, useValue: mockTikTokAdapter },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<TikTokOAuthService>(TikTokOAuthService);
    oAuthStateService = module.get(OAuthStateService);
    tikTokAdapter = module.get(TikTokAdapter);
    prisma = module.get(PrismaService);
    cryptoService = module.get(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConnectUrl', () => {
    it('should generate secure state and return authorization URL', async () => {
      const result = await service.getConnectUrl(userId1);

      expect(oAuthStateService.generateState).toHaveBeenCalledWith(
        userId1,
        Platform.TIKTOK,
      );
      expect(tikTokAdapter.buildAuthorizationUrl).toHaveBeenCalledWith(mockState);
      expect(result.url).toContain('https://www.tiktok.com/v2/auth/authorize/');
    });
  });

  describe('handleCallback', () => {
    it('should redirect to error URL if TikTok returned an OAuth error / denial', async () => {
      const result = await service.handleCallback({
        error: 'access_denied',
        error_description: 'User canceled the authorization',
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
        id: 'new-account-uuid-1',
        platform: Platform.TIKTOK,
        platformAccountId: mockProfile.platformAccountId,
        username: mockProfile.username,
        profileImageUrl: mockProfile.profileImageUrl,
        accessToken: 'v1:enc:act.real_tiktok_access_token',
        tokenExpiry: new Date(Date.now() + 86400 * 1000),
        refreshToken: 'v1:enc:rft.real_tiktok_refresh_token',
        refreshTokenExpiry: new Date(Date.now() + 31536000 * 1000),
        connectionStatus: ConnectionStatus.CONNECTED,
        userId: userId1,
      });

      const result = await service.handleCallback({
        code: mockCode,
        state: mockState,
      });

      expect(oAuthStateService.validateAndConsumeState).toHaveBeenCalledWith(
        mockState,
        Platform.TIKTOK,
      );
      expect(tikTokAdapter.exchangeCode).toHaveBeenCalledWith(mockCode);
      expect(tikTokAdapter.getProfile).toHaveBeenCalledWith(
        mockTokenResponse.accessToken,
      );
      expect(cryptoService.encrypt).toHaveBeenCalledWith(
        mockTokenResponse.accessToken,
      );
      expect(cryptoService.encrypt).toHaveBeenCalledWith(
        mockTokenResponse.refreshToken,
      );
      expect(prisma.socialAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: Platform.TIKTOK,
          platformAccountId: mockProfile.platformAccountId,
          username: mockProfile.username,
          profileImageUrl: mockProfile.profileImageUrl,
          accessToken: 'v1:enc:act.real_tiktok_access_token',
          refreshToken: 'v1:enc:rft.real_tiktok_refresh_token',
          connectionStatus: ConnectionStatus.CONNECTED,
          userId: userId1,
        }),
      });

      expect(result.redirectUrl).toContain('status=success');
      expect(result.redirectUrl).toContain('platform=tiktok');
      expect(result.redirectUrl).toContain('accountId=new-account-uuid-1');
    });

    it('should reconnect and update existing account when reconnecting the same TikTok account for the same user', async () => {
      const existingAccount = {
        id: 'existing-acc-uuid-1',
        platform: Platform.TIKTOK,
        platformAccountId: mockProfile.platformAccountId,
        userId: userId1, // Same user
      };

      (prisma.socialAccount.findUnique as jest.Mock).mockResolvedValue(existingAccount);
      (prisma.socialAccount.update as jest.Mock).mockResolvedValue({
        ...existingAccount,
        id: 'existing-acc-uuid-1',
      });

      const result = await service.handleCallback({
        code: mockCode,
        state: mockState,
      });

      expect(prisma.socialAccount.update).toHaveBeenCalledWith({
        where: { id: existingAccount.id },
        data: expect.objectContaining({
          username: mockProfile.username,
          accessToken: 'v1:enc:act.real_tiktok_access_token',
          refreshToken: 'v1:enc:rft.real_tiktok_refresh_token',
          connectionStatus: ConnectionStatus.CONNECTED,
        }),
      });
      expect(prisma.socialAccount.create).not.toHaveBeenCalled();
      expect(result.redirectUrl).toContain('accountId=existing-acc-uuid-1');
    });

    it('should reject connection and redirect to error if the TikTok account is already linked to a different OmniPost user', async () => {
      const accountBelongingToAnotherUser = {
        id: 'existing-acc-uuid-2',
        platform: Platform.TIKTOK,
        platformAccountId: mockProfile.platformAccountId,
        userId: userId2, // Different user!
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
  });
});
