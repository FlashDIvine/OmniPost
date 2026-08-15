import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TikTokAdapter } from './tiktok.adapter';

describe('TikTokAdapter', () => {
  let adapter: TikTokAdapter;

  const mockConfig: Record<string, string> = {
    TIKTOK_CLIENT_KEY: 'test_client_key_123',
    TIKTOK_CLIENT_SECRET: 'test_client_secret_456',
    TIKTOK_REDIRECT_URI: 'http://localhost:3001/api/social-accounts/tiktok/callback',
    TIKTOK_SCOPES: 'user.info.basic,user.info.profile',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => mockConfig[key] ?? null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TikTokAdapter,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get<TikTokAdapter>(TikTokAdapter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('buildAuthorizationUrl', () => {
    it('should generate a valid TikTok OAuth v2 authorization URL with required parameters', () => {
      const state = 'mock_random_state_hex_string';
      const urlString = adapter.buildAuthorizationUrl(state);

      expect(urlString.startsWith('https://www.tiktok.com/v2/auth/authorize/')).toBe(true);

      const parsed = new URL(urlString);
      expect(parsed.searchParams.get('client_key')).toBe('test_client_key_123');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3001/api/social-accounts/tiktok/callback',
      );
      expect(parsed.searchParams.get('scope')).toBe('user.info.basic,user.info.profile');
      expect(parsed.searchParams.get('state')).toBe(state);
    });

    it('should throw an error if TIKTOK_CLIENT_KEY is not configured', async () => {
      const mockConfigService = {
        get: jest.fn((key: string) => (key === 'TIKTOK_REDIRECT_URI' ? 'http://redirect' : null)),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TikTokAdapter,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const adp = module.get<TikTokAdapter>(TikTokAdapter);
      expect(() => adp.buildAuthorizationUrl('state')).toThrow(
        'TIKTOK_CLIENT_KEY and TIKTOK_REDIRECT_URI must be configured',
      );
    });
  });

  describe('exchangeCode', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'act.test_access_token_123',
          expires_in: 86400,
          open_id: '_000test_open_id_123',
          refresh_token: 'rft.test_refresh_token_456',
          refresh_expires_in: 31536000,
          scope: 'user.info.basic',
          token_type: 'Bearer',
        },
        error: {
          code: 'ok',
          message: '',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await adapter.exchangeCode('auth_code_123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/oauth/token/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );

      expect(result).toEqual({
        accessToken: 'act.test_access_token_123',
        expiresIn: 86400,
        openId: '_000test_open_id_123',
        refreshToken: 'rft.test_refresh_token_456',
        refreshExpiresIn: 31536000,
        scope: 'user.info.basic',
        tokenType: 'Bearer',
      });
    });

    it('should throw an error when token endpoint returns non-200 HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      await expect(adapter.exchangeCode('invalid_code')).rejects.toThrow(
        'TikTok authentication server returned an error',
      );
    });
  });

  describe('getProfile', () => {
    it('should fetch user profile from TikTok User Info API v2', async () => {
      const mockResponse = {
        data: {
          user: {
            open_id: '_000user_open_id_789',
            union_id: '_000user_union_id_789',
            avatar_url: 'https://p16.tiktokcdn.com/avatar.jpeg',
            display_name: 'TikTok Star',
            username: 'tiktokstar',
          },
        },
        error: {
          code: 'ok',
          message: '',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const profile = await adapter.getProfile('valid_token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://open.tiktokapis.com/v2/user/info/'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        }),
      );

      expect(profile).toEqual({
        platformAccountId: '_000user_open_id_789',
        username: 'tiktokstar',
        profileImageUrl: 'https://p16.tiktokcdn.com/avatar.jpeg',
      });
    });
  });
});
