import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TikTokApiClient } from './tiktok-api.client';

describe('TikTokApiClient', () => {
  let client: TikTokApiClient;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TikTokApiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'TIKTOK_API_BASE_URL') {
                return 'https://open.tiktokapis.com/v2';
              }
              if (key === 'TIKTOK_API_TIMEOUT_MS') {
                return '5000';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    client = module.get<TikTokApiClient>(TikTokApiClient);
  });

  describe('queryCreatorInfo', () => {
    it('should construct correct POST request to /post/publish/creator_info/query/', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            creator_avatar_url: 'https://p16.tiktokcdn.com/avatar.jpeg',
            creator_nickname: 'TikTok Creator',
            creator_username: 'creator_tt',
            privacy_level_options: [
              'PUBLIC_TO_EVERYONE',
              'MUTUAL_FOLLOW_FRIENDS',
              'SELF_ONLY',
            ],
            comment_disabled: false,
            duet_disabled: false,
            stitch_disabled: false,
            max_video_post_duration_sec: 600,
          },
          error: { code: 'ok', message: '' },
        }),
      });

      const res = await client.queryCreatorInfo('act.test_token_123');

      expect(res.creator_username).toBe('creator_tt');
      expect(res.privacy_level_options).toContain('PUBLIC_TO_EVERYONE');
      expect(res.max_video_post_duration_sec).toBe(600);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer act.test_token_123',
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: '{}',
        }),
      );
    });
  });

  describe('initVideoPublish', () => {
    it('should construct correct POST request to /post/publish/video/init/', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            publish_id: 'v_pub_vid_12345',
          },
          error: { code: 'ok', message: '' },
        }),
      });

      const res = await client.initVideoPublish('act.test_token_123', {
        post_info: {
          title: 'Exciting TikTok Video #viral',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: 'https://cdn.example.com/media/video.mp4',
        },
      });

      expect(res.publish_id).toBe('v_pub_vid_12345');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer act.test_token_123',
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            post_info: {
              title: 'Exciting TikTok Video #viral',
              privacy_level: 'PUBLIC_TO_EVERYONE',
              disable_comment: false,
              disable_duet: false,
              disable_stitch: false,
              video_cover_timestamp_ms: 1000,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: 'https://cdn.example.com/media/video.mp4',
            },
          }),
        }),
      );
    });
  });

  describe('initPhotoPublish', () => {
    it('should construct correct POST request to /post/publish/content/init/ for photo post', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            publish_id: 'v_pub_photo_67890',
          },
          error: { code: 'ok', message: '' },
        }),
      });

      const res = await client.initPhotoPublish('act.test_token_123', {
        media_type: 'PHOTO',
        post_mode: 'DIRECT_POST',
        post_info: {
          title: 'Photo Carousel #photo',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          auto_add_music: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 1,
          photo_images: [
            'https://cdn.example.com/media/photo1.jpg',
            'https://cdn.example.com/media/photo2.webp',
          ],
        },
      });

      expect(res.publish_id).toBe('v_pub_photo_67890');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/post/publish/content/init/',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer act.test_token_123',
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            media_type: 'PHOTO',
            post_mode: 'DIRECT_POST',
            post_info: {
              title: 'Photo Carousel #photo',
              privacy_level: 'PUBLIC_TO_EVERYONE',
              disable_comment: false,
              auto_add_music: false,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              photo_cover_index: 1,
              photo_images: [
                'https://cdn.example.com/media/photo1.jpg',
                'https://cdn.example.com/media/photo2.webp',
              ],
            },
          }),
        }),
      );
    });
  });

  describe('fetchPublishStatus', () => {
    it('should construct correct POST request to /post/publish/status/fetch/', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 'PUBLISH_COMPLETE',
            public_post_id: '7123456789012345678',
          },
          error: { code: 'ok', message: '' },
        }),
      });

      const res = await client.fetchPublishStatus(
        'act.test_token_123',
        'v_pub_vid_12345',
      );

      expect(res.status).toBe('PUBLISH_COMPLETE');
      expect(res.public_post_id).toBe('7123456789012345678');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer act.test_token_123',
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: 'v_pub_vid_12345' }),
        }),
      );
    });
  });

  describe('Error Normalization & Token Redaction', () => {
    it('should classify timeout / AbortError as RETRYABLE', () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';

      const norm = client.normalizeError(abortErr);
      expect(norm.classification).toBe('RETRYABLE');
      expect(norm.apiErrorCode).toBe('API_TIMEOUT');
    });

    it('should classify rate limit (HTTP 429 / spam_risk_user_rate_limit) as RETRYABLE', () => {
      const norm = client.normalizeError(null, 429, {
        error: {
          message: 'Rate limit reached, please try again later',
          code: 'spam_risk_user_rate_limit',
        },
      });
      expect(norm.classification).toBe('RETRYABLE');
      expect(norm.apiErrorCode).toBe('spam_risk_user_rate_limit');
    });

    it('should classify 5xx server error as RETRYABLE', () => {
      const norm = client.normalizeError(null, 500, {
        error: { message: 'Internal server error', code: '50000' },
      });
      expect(norm.classification).toBe('RETRYABLE');
      expect(norm.apiErrorCode).toBe('50000');
    });

    it('should classify expired / invalid token as PERMANENT', () => {
      const norm = client.normalizeError(null, 401, {
        error: {
          message: 'The access token is invalid or expired',
          code: 'access_token_invalid',
        },
      });
      expect(norm.classification).toBe('PERMANENT');
      expect(norm.apiErrorCode).toBe('access_token_invalid');
    });

    it('should redact act. / rft. tokens and Bearer headers from error messages', () => {
      const norm = client.normalizeError(null, 400, {
        error: {
          message:
            'Invalid token: act.abcdef123456789 and rft.xyz987654321 with Bearer act.secret123',
          code: 'invalid_params',
        },
      });
      expect(norm.message).not.toContain('act.abcdef123456789');
      expect(norm.message).not.toContain('rft.xyz987654321');
      expect(norm.message).not.toContain('act.secret123');
      expect(norm.message).toContain('[REDACTED_TOKEN]');
    });
  });
});
