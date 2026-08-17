import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorClassification,
  PublishError,
} from '../../types/publish-error.type';

export interface InstagramContainerStatus {
  statusCode: 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'EXPIRED' | 'PUBLISHED' | string;
  status?: string;
}

export interface InstagramMediaDetails {
  id: string;
  permalink?: string;
}

@Injectable()
export class InstagramApiClient {
  private readonly logger = new Logger(InstagramApiClient.name);
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('INSTAGRAM_API_BASE_URL') ||
      'https://graph.instagram.com'
    ).replace(/\/+$/, '');
    this.apiVersion =
      this.configService.get<string>('INSTAGRAM_API_VERSION') || 'v21.0';
    this.timeoutMs = parseInt(
      this.configService.get<string>('INSTAGRAM_API_TIMEOUT_MS') || '15000',
      10,
    );
  }

  /**
   * Creates an Instagram media container for a single image.
   */
  async createImageContainer(
    igUserId: string,
    accessToken: string,
    params: {
      imageUrl: string;
      caption?: string;
      isCarouselItem?: boolean;
    },
  ): Promise<{ id: string }> {
    const url = `${this.baseUrl}/${this.apiVersion}/${igUserId}/media`;
    const formParams = new URLSearchParams();
    formParams.set('image_url', params.imageUrl);

    if (params.isCarouselItem) {
      formParams.set('is_carousel_item', 'true');
    } else if (params.caption) {
      formParams.set('caption', params.caption);
    }

    return this.postRequest<{ id: string }>(url, formParams, accessToken);
  }

  /**
   * Creates an Instagram media container for a video / reel or carousel video child.
   */
  async createVideoContainer(
    igUserId: string,
    accessToken: string,
    params: {
      videoUrl: string;
      caption?: string;
      coverUrl?: string;
      isCarouselItem?: boolean;
    },
  ): Promise<{ id: string }> {
    const url = `${this.baseUrl}/${this.apiVersion}/${igUserId}/media`;
    const formParams = new URLSearchParams();
    formParams.set('video_url', params.videoUrl);
    formParams.set(
      'media_type',
      params.isCarouselItem ? 'VIDEO' : 'REELS',
    );

    if (params.isCarouselItem) {
      formParams.set('is_carousel_item', 'true');
    } else {
      if (params.caption) {
        formParams.set('caption', params.caption);
      }
      if (params.coverUrl) {
        formParams.set('cover_url', params.coverUrl);
      }
    }

    return this.postRequest<{ id: string }>(url, formParams, accessToken);
  }

  /**
   * Creates a parent carousel container referencing children container IDs.
   */
  async createCarouselContainer(
    igUserId: string,
    accessToken: string,
    params: {
      children: string[];
      caption?: string;
    },
  ): Promise<{ id: string }> {
    const url = `${this.baseUrl}/${this.apiVersion}/${igUserId}/media`;
    const formParams = new URLSearchParams();
    formParams.set('media_type', 'CAROUSEL');
    formParams.set('children', params.children.join(','));

    if (params.caption) {
      formParams.set('caption', params.caption);
    }

    return this.postRequest<{ id: string }>(url, formParams, accessToken);
  }

  /**
   * Checks the status of a media container.
   */
  async getContainerStatus(
    containerId: string,
    accessToken: string,
  ): Promise<InstagramContainerStatus> {
    const url = `${this.baseUrl}/${this.apiVersion}/${containerId}?fields=status_code,status`;
    const data = await this.getRequest<{
      status_code?: string;
      status?: string;
    }>(url, accessToken);

    return {
      statusCode: (data.status_code || 'FINISHED').toUpperCase(),
      status: data.status,
    };
  }

  /**
   * Publishes a completed media container.
   */
  async publishContainer(
    igUserId: string,
    accessToken: string,
    creationId: string,
  ): Promise<{ id: string }> {
    const url = `${this.baseUrl}/${this.apiVersion}/${igUserId}/media_publish`;
    const formParams = new URLSearchParams();
    formParams.set('creation_id', creationId);

    return this.postRequest<{ id: string }>(url, formParams, accessToken);
  }

  /**
   * Retrieves permalink and details for a published Instagram media item.
   */
  async getMediaDetails(
    mediaId: string,
    accessToken: string,
  ): Promise<InstagramMediaDetails> {
    const url = `${this.baseUrl}/${this.apiVersion}/${mediaId}?fields=id,permalink`;
    return this.getRequest<InstagramMediaDetails>(url, accessToken);
  }

  /**
   * Helper executing POST requests with bounded timeout and safe error normalization.
   */
  private async postRequest<T>(
    url: string,
    body: URLSearchParams,
    accessToken: string,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      throw this.normalizeError(err);
    }

    return this.parseResponse<T>(response);
  }

  /**
   * Helper executing GET requests with bounded timeout and safe error normalization.
   */
  private async getRequest<T>(
    url: string,
    accessToken: string,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      throw this.normalizeError(err);
    }

    return this.parseResponse<T>(response);
  }

  /**
   * Parses JSON response and converts HTTP / Meta Graph API error structures to PublishError.
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
        new Error('Failed to parse Instagram API JSON response'),
        response.status,
      );
    }

    if (!response.ok || data.error) {
      throw this.normalizeError(null, response.status, data);
    }

    return data as T;
  }

  /**
   * Normalizes network, HTTP, and Meta Graph API errors into a typed PublishError.
   */
  public normalizeError(
    err: any,
    status?: number,
    body?: any,
  ): PublishError {
    // 1. Timeout / Network errors
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return {
        message: 'Instagram API request timed out',
        apiErrorCode: 'API_TIMEOUT',
        classification: 'RETRYABLE',
      };
    }

    const metaError = body?.error;
    const rawMessage =
      metaError?.message ||
      err?.message ||
      `Instagram API request failed with status ${status || 500}`;

    const sanitizedMessage = this.sanitizeErrorMessage(rawMessage);
    const errorCode = metaError?.code ? String(metaError.code) : undefined;
    const subCode = metaError?.error_subcode
      ? String(metaError.error_subcode)
      : undefined;

    let classification: ErrorClassification = 'PERMANENT';

    // 2. Classify retryable vs permanent errors
    // Rate limit / Throttling (HTTP 429, error codes 32, 4, 17)
    if (
      status === 429 ||
      errorCode === '32' ||
      errorCode === '4' ||
      errorCode === '17' ||
      metaError?.is_transient === true
    ) {
      classification = 'RETRYABLE';
    }
    // Server errors (HTTP 5xx, code 1, 2)
    else if (
      (status && status >= 500 && status < 600) ||
      errorCode === '1' ||
      errorCode === '2'
    ) {
      classification = 'RETRYABLE';
    }
    // OAuth Token Expired / Invalid Token (code 190, subcode 463, 467)
    else if (errorCode === '190' || subCode === '463' || subCode === '467') {
      classification = 'PERMANENT';
    }

    return {
      message: sanitizedMessage,
      apiErrorCode: subCode ? `${errorCode}_${subCode}` : errorCode,
      classification,
      rawError: { status, metaError },
    };
  }

  /**
   * Redacts sensitive tokens or credentials from error messages.
   */
  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/EAAG[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/act\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer [REDACTED]')
      .slice(0, 500);
  }
}
