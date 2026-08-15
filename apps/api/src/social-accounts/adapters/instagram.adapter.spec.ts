import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InstagramAdapter } from './instagram.adapter';

describe('InstagramAdapter', () => {
  let adapter: InstagramAdapter;

  const mockConfig: Record<string, string> = {
    INSTAGRAM_CLIENT_ID: 'test_ig_client_id_123',
    INSTAGRAM_CLIENT_SECRET: 'test_ig_client_secret_456',
    INSTAGRAM_REDIRECT_URI: 'http://localhost:3001/api/social-accounts/instagram/callback',
    INSTAGRAM_SCOPES: 'instagram_business_basic',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => mockConfig[key] ?? null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramAdapter,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get<InstagramAdapter>(InstagramAdapter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('buildAuthorizationUrl', () => {
    it('should generate a valid Instagram Login authorization URL with required parameters', () => {
      const state = 'mock_random_state_hex_string';
      const urlString = adapter.buildAuthorizationUrl(state);

      expect(urlString.startsWith('https://www.instagram.com/oauth/authorize')).toBe(true);

      const parsed = new URL(urlString);
      expect(parsed.searchParams.get('client_id')).toBe('test_ig_client_id_123');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3001/api/social-accounts/instagram/callback',
      );
      expect(parsed.searchParams.get('scope')).toBe('instagram_business_basic');
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('enable_fb_login')).toBe('0');
    });

    it('should throw an error if INSTAGRAM_CLIENT_ID is not configured', async () => {
      const mockConfigService = {
        get: jest.fn((key: string) =>
          key === 'INSTAGRAM_REDIRECT_URI' ? 'http://redirect' : null,
        ),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InstagramAdapter,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const adp = module.get<InstagramAdapter>(InstagramAdapter);
      expect(() => adp.buildAuthorizationUrl('state')).toThrow(
        'INSTAGRAM_CLIENT_ID and INSTAGRAM_REDIRECT_URI must be configured',
      );
    });
  });

  describe('exchangeCode', () => {
    it('should exchange code and upgrade to long-lived token', async () => {
      const mockShortLivedResponse = {
        access_token: 'IGQ_short_lived_token_123',
        user_id: '17841400000000001',
        permissions: ['instagram_business_basic'],
      };

      const mockLongLivedResponse = {
        access_token: 'IGQ_long_lived_token_456',
        token_type: 'bearer',
        expires_in: 5184000,
      };

      global.fetch = jest.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/oauth/access_token')) {
          return {
            ok: true,
            json: async () => mockShortLivedResponse,
          };
        }
        if (urlStr.includes('/access_token')) {
          return {
            ok: true,
            json: async () => mockLongLivedResponse,
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      const result = await adapter.exchangeCode('auth_code_123');

      expect(result).toEqual({
        accessToken: 'IGQ_long_lived_token_456',
        userId: '17841400000000001',
        expiresIn: 5184000,
        permissions: ['instagram_business_basic'],
      });
    });

    it('should strip trailing #_ from authorization code before exchanging', async () => {
      let passedBody = '';
      global.fetch = jest.fn().mockImplementation(async (url: string | URL, opts: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/oauth/access_token')) {
          passedBody = opts?.body;
          return {
            ok: true,
            json: async () => ({
              access_token: 'IGQ_short_token',
              user_id: '12345',
            }),
          };
        }
        if (urlStr.includes('/access_token')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'IGQ_long_token',
              expires_in: 5184000,
            }),
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      await adapter.exchangeCode('auth_code_with_hash#_');
      expect(passedBody).toContain('code=auth_code_with_hash');
      expect(passedBody).not.toContain('#_');
    });

    it('should throw an error when token endpoint returns non-200 HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      await expect(adapter.exchangeCode('invalid_code')).rejects.toThrow(
        'Instagram authentication server returned an error',
      );
    });
  });

  describe('getProfile', () => {
    it('should fetch Instagram Professional Account profile details for Business account', async () => {
      const mockResponse = {
        id: '17841400000000001',
        username: 'my_business_page',
        name: 'My Business Page',
        account_type: 'BUSINESS',
        profile_picture_url: 'https://example.com/ig_avatar.jpg',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const profile = await adapter.getProfile('valid_token');

      expect(profile).toEqual({
        platformAccountId: '17841400000000001',
        username: 'my_business_page',
        profileImageUrl: 'https://example.com/ig_avatar.jpg',
        accountType: 'BUSINESS',
        name: 'My Business Page',
      });
    });

    it('should fetch Instagram Professional Account profile details for Creator account', async () => {
      const mockResponse = {
        id: '17841400000000002',
        username: 'creator_page',
        name: 'Creator Page',
        account_type: 'CREATOR',
        profile_picture_url: null,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const profile = await adapter.getProfile('valid_token');

      expect(profile.platformAccountId).toBe('17841400000000002');
      expect(profile.accountType).toBe('CREATOR');
    });

    it('should reject Personal/consumer account and throw descriptive error', async () => {
      const mockResponse = {
        id: '17841400000000003',
        username: 'personal_user',
        name: 'Personal User',
        account_type: 'PERSONAL',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      await expect(adapter.getProfile('valid_token')).rejects.toThrow(
        'Only Instagram Professional accounts (Business or Creator) are supported',
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh long-lived Instagram access token', async () => {
      const mockResponse = {
        access_token: 'IGQ_refreshed_long_lived_token',
        token_type: 'bearer',
        expires_in: 5184000,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await adapter.refreshToken('old_token');

      expect(result.accessToken).toBe('IGQ_refreshed_long_lived_token');
      expect(result.tokenExpiry).toBeInstanceOf(Date);
    });
  });
});
