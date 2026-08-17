import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InstagramApiClient } from './instagram-api.client';

describe('InstagramApiClient', () => {
  let client: InstagramApiClient;
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
        InstagramApiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'INSTAGRAM_API_BASE_URL') {
                return 'https://graph.instagram.com';
              }
              if (key === 'INSTAGRAM_API_VERSION') {
                return 'v21.0';
              }
              if (key === 'INSTAGRAM_API_TIMEOUT_MS') {
                return '5000';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    client = module.get<InstagramApiClient>(InstagramApiClient);
  });

  describe('createImageContainer', () => {
    it('should construct correct POST request for single image container', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'container_img_123' }),
      });

      const res = await client.createImageContainer(
        'ig_user_123',
        'EAAG_test_token',
        {
          imageUrl: 'https://cdn.example.com/img.jpg',
          caption: 'Beautiful sunset #travel',
        },
      );

      expect(res.id).toBe('container_img_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v21.0/ig_user_123/media',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer EAAG_test_token',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'image_url=https%3A%2F%2Fcdn.example.com%2Fimg.jpg&caption=Beautiful+sunset+%23travel',
        }),
      );
    });

    it('should construct correct request for carousel child image (no caption, is_carousel_item=true)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'child_container_123' }),
      });

      const res = await client.createImageContainer(
        'ig_user_123',
        'EAAG_test_token',
        {
          imageUrl: 'https://cdn.example.com/item1.jpg',
          caption: 'Should be ignored on child',
          isCarouselItem: true,
        },
      );

      expect(res.id).toBe('child_container_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v21.0/ig_user_123/media',
        expect.objectContaining({
          body: 'image_url=https%3A%2F%2Fcdn.example.com%2Fitem1.jpg&is_carousel_item=true',
        }),
      );
    });
  });

  describe('createVideoContainer', () => {
    it('should construct correct request for single video / Reels container', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'container_vid_123' }),
      });

      const res = await client.createVideoContainer(
        'ig_user_123',
        'EAAG_test_token',
        {
          videoUrl: 'https://cdn.example.com/video.mp4',
          caption: 'Video caption',
          coverUrl: 'https://cdn.example.com/cover.jpg',
        },
      );

      expect(res.id).toBe('container_vid_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v21.0/ig_user_123/media',
        expect.objectContaining({
          body: 'video_url=https%3A%2F%2Fcdn.example.com%2Fvideo.mp4&media_type=REELS&caption=Video+caption&cover_url=https%3A%2F%2Fcdn.example.com%2Fcover.jpg',
        }),
      );
    });
  });

  describe('createCarouselContainer', () => {
    it('should construct correct request with comma-separated children container IDs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'parent_carousel_123' }),
      });

      const res = await client.createCarouselContainer(
        'ig_user_123',
        'EAAG_test_token',
        {
          children: ['child1', 'child2', 'child3'],
          caption: 'Carousel album caption',
        },
      );

      expect(res.id).toBe('parent_carousel_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v21.0/ig_user_123/media',
        expect.objectContaining({
          body: 'media_type=CAROUSEL&children=child1%2Cchild2%2Cchild3&caption=Carousel+album+caption',
        }),
      );
    });
  });

  describe('getContainerStatus', () => {
    it('should fetch status_code and status fields', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status_code: 'FINISHED', status: 'ready' }),
      });

      const status = await client.getContainerStatus(
        'container_123',
        'EAAG_test_token',
      );

      expect(status.statusCode).toBe('FINISHED');
      expect(status.status).toBe('ready');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v21.0/container_123?fields=status_code,status',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer EAAG_test_token',
          },
        }),
      );
    });
  });

  describe('publishContainer', () => {
    it('should post creation_id to media_publish endpoint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'published_ig_media_123' }),
      });

      const res = await client.publishContainer(
        'ig_user_123',
        'EAAG_test_token',
        'container_123',
      );

      expect(res.id).toBe('published_ig_media_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v21.0/ig_user_123/media_publish',
        expect.objectContaining({
          method: 'POST',
          body: 'creation_id=container_123',
        }),
      );
    });
  });

  describe('getMediaDetails', () => {
    it('should retrieve permalink for published media ID', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'published_ig_media_123',
          permalink: 'https://www.instagram.com/p/Cxyz123/',
        }),
      });

      const details = await client.getMediaDetails(
        'published_ig_media_123',
        'EAAG_test_token',
      );

      expect(details.id).toBe('published_ig_media_123');
      expect(details.permalink).toBe('https://www.instagram.com/p/Cxyz123/');
    });
  });

  describe('Error Normalization & Token Sanitization', () => {
    it('should classify timeout / AbortError as RETRYABLE', () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';

      const norm = client.normalizeError(abortErr);
      expect(norm.classification).toBe('RETRYABLE');
      expect(norm.apiErrorCode).toBe('API_TIMEOUT');
    });

    it('should classify rate limit (HTTP 429 / code 32) as RETRYABLE', () => {
      const norm = client.normalizeError(null, 429, {
        error: { message: 'Rate limit exceeded', code: 32 },
      });
      expect(norm.classification).toBe('RETRYABLE');
      expect(norm.apiErrorCode).toBe('32');
    });

    it('should classify 5xx server error as RETRYABLE', () => {
      const norm = client.normalizeError(null, 500, {
        error: { message: 'Internal server error', code: 1 },
      });
      expect(norm.classification).toBe('RETRYABLE');
      expect(norm.apiErrorCode).toBe('1');
    });

    it('should classify expired / invalid OAuth token (code 190 subcode 463) as PERMANENT', () => {
      const norm = client.normalizeError(null, 400, {
        error: {
          message: 'Error validating access token: Session has expired',
          code: 190,
          error_subcode: 463,
        },
      });
      expect(norm.classification).toBe('PERMANENT');
      expect(norm.apiErrorCode).toBe('190_463');
    });

    it('should redact EAAG tokens and Bearer headers from error messages', () => {
      const norm = client.normalizeError(null, 400, {
        error: {
          message:
            'Invalid token: EAAG1234567890abcdefghijklmnopqrstuvwxyz in Authorization: Bearer EAAGsecret',
          code: 100,
        },
      });
      expect(norm.message).not.toContain('EAAG1234567890');
      expect(norm.message).not.toContain('EAAGsecret');
      expect(norm.message).toContain('[REDACTED_TOKEN]');
    });
  });
});
