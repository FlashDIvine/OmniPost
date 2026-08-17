import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorClassification,
  PublishError,
} from '../../types/publish-error.type';

export interface TikTokCreatorInfo {
  creator_avatar_url?: string;
  creator_nickname?: string;
  creator_username?: string;
  privacy_level_options: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
}

export interface TikTokPublishInitResponse {
  publish_id: string;
}

export interface TikTokVideoPublishPayload {
  post_info: {
    title?: string;
    privacy_level: string;
    disable_duet?: boolean;
    disable_comment?: boolean;
    disable_stitch?: boolean;
    video_cover_timestamp_ms?: number;
  };
  source_info: {
    source: 'PULL_FROM_URL';
    video_url: string;
  };
}

export interface TikTokPhotoPublishPayload {
  media_type: 'PHOTO';
  post_mode: 'DIRECT_POST';
  post_info: {
    title?: string;
    privacy_level: string;
    disable_comment?: boolean;
    auto_add_music?: boolean;
  };
  source_info: {
    source: 'PULL_FROM_URL';
    photo_cover_index?: number;
    photo_images: string[];
  };
}

export interface TikTokPublishStatusResponse {
  status:
    | 'PROCESSING_DOWNLOAD'
    | 'PROCESSING_UPLOAD'
    | 'PUBLISH_COMPLETE'
    | 'FAILED'
    | string;
  fail_reason?: string;
  public_post_id?: string;
  public_post_ids?: string[];
  uploaded_bytes?: number;
}

@Injectable()
export class TikTokApiClient {
  private readonly logger = new Logger(TikTokApiClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('TIKTOK_API_BASE_URL') ||
      'https://open.tiktokapis.com/v2'
    ).replace(/\/+$/, '');
    this.timeoutMs = parseInt(
      this.configService.get<string>('TIKTOK_API_TIMEOUT_MS') || '10000',
      10,
    );
  }

  /**
   * Queries TikTok creator information before initiating publishing.
   * Endpoint: POST /post/publish/creator_info/query/
   */
  async queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const url = `${this.baseUrl}/post/publish/creator_info/query/`;
    const response = await this.postJson<{ data: TikTokCreatorInfo }>(
      url,
      {},
      accessToken,
    );
    return response.data;
  }

  /**
   * Initializes a Video Direct Post with source PULL_FROM_URL.
   * Endpoint: POST /post/publish/video/init/
   */
  async initVideoPublish(
    accessToken: string,
    payload: TikTokVideoPublishPayload,
  ): Promise<TikTokPublishInitResponse> {
    const url = `${this.baseUrl}/post/publish/video/init/`;
    const response = await this.postJson<{ data: TikTokPublishInitResponse }>(
      url,
      payload,
      accessToken,
    );
    return response.data;
  }

  /**
   * Initializes a Photo Direct Post with source PULL_FROM_URL.
   * Endpoint: POST /post/publish/content/init/
   */
  async initPhotoPublish(
    accessToken: string,
    payload: TikTokPhotoPublishPayload,
  ): Promise<TikTokPublishInitResponse> {
    const url = `${this.baseUrl}/post/publish/content/init/`;
    const response = await this.postJson<{ data: TikTokPublishInitResponse }>(
      url,
      payload,
      accessToken,
    );
    return response.data;
  }

  /**
   * Fetches publishing progress/status for a given publish_id.
   * Endpoint: POST /post/publish/status/fetch/
   */
  async fetchPublishStatus(
    accessToken: string,
    publishId: string,
  ): Promise<TikTokPublishStatusResponse> {
    const url = `${this.baseUrl}/post/publish/status/fetch/`;
    const response = await this.postJson<{ data: TikTokPublishStatusResponse }>(
      url,
      { publish_id: publishId },
      accessToken,
    );
    return response.data;
  }

  /**
   * Internal helper executing authenticated POST JSON requests with bounded timeout.
   */
  private async postJson<T>(
    url: string,
    body: any,
    accessToken: string,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      throw this.normalizeError(err);
    }

    return this.parseResponse<T>(response);
  }

  /**
   * Parses JSON response and validates TikTok API response wrapper format.
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    let data: any;
    try {
      data = await response.json();
    } catch (jsonErr: any) {
      if (!response.ok) {
        throw this.normalizeError(
          new Error(`HTTP ${response.status} ${response.statusText}`),
          response.status,
        );
      }
      throw this.normalizeError(
        new Error('Failed to parse TikTok API JSON response'),
        response.status,
      );
    }

    if (
      !response.ok ||
      (data.error &&
        data.error.code !== 'ok' &&
        data.error.code !== 0 &&
        data.error.code !== '0')
    ) {
      throw this.normalizeError(null, response.status, data);
    }

    return data as T;
  }

  /**
   * Normalizes network, HTTP, and TikTok API errors into a typed PublishError.
   */
  public normalizeError(
    err: any,
    status?: number,
    body?: any,
  ): PublishError {
    // 1. Timeout / Network abort errors
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return {
        message: 'TikTok API request timed out',
        apiErrorCode: 'API_TIMEOUT',
        classification: 'RETRYABLE',
      };
    }

    const ttError = body?.error;
    const rawMessage =
      ttError?.message ||
      err?.message ||
      `TikTok API request failed with status ${status || 500}`;

    const sanitizedMessage = this.sanitizeErrorMessage(rawMessage);
    const errorCode = ttError?.code ? String(ttError.code) : undefined;

    let classification: ErrorClassification = 'PERMANENT';

    // 2. Classify retryable vs permanent errors
    // Rate limit / Throttling (HTTP 429, spam risk user rate limit, 42900)
    if (
      status === 429 ||
      errorCode === '429' ||
      errorCode === '42900' ||
      errorCode === 'rate_limit_exceeded' ||
      errorCode === 'spam_risk_user_rate_limit'
    ) {
      classification = 'RETRYABLE';
    }
    // Server errors (HTTP 5xx, code 50000, internal_error)
    else if (
      (status && status >= 500 && status < 600) ||
      errorCode === '50000' ||
      errorCode === 'internal_error'
    ) {
      classification = 'RETRYABLE';
    }
    // OAuth Token Expired / Invalid Token (access_token_invalid, token_expired, 40101, 40102)
    else if (
      status === 401 ||
      errorCode === 'access_token_invalid' ||
      errorCode === 'token_expired' ||
      errorCode === 'invalid_token' ||
      errorCode === 'invalid_grant' ||
      errorCode === '40101' ||
      errorCode === '40102'
    ) {
      classification = 'PERMANENT';
    }

    return {
      message: sanitizedMessage,
      apiErrorCode: errorCode,
      classification,
      rawError: { status, ttError },
    };
  }

  /**
   * Redacts sensitive tokens or credentials from error messages.
   */
  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/act\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/rft\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/EAAG[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer [REDACTED]')
      .slice(0, 500);
  }
}
