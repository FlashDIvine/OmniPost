import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '../../../generated/prisma/client';
import {
  PlatformAdapter,
  PlatformProfile,
  PlatformTokenResult,
} from './platform-adapter.interface';

export interface InstagramTokenResponse {
  accessToken: string;
  userId: string;
  expiresIn?: number;
  permissions?: string[];
}

export interface InstagramProfile extends PlatformProfile {
  accountType?: string;
  name?: string;
}

@Injectable()
export class InstagramAdapter implements PlatformAdapter {
  readonly platform = Platform.INSTAGRAM;
  private readonly logger = new Logger(InstagramAdapter.name);

  private readonly authorizeBaseUrl = 'https://www.instagram.com/oauth/authorize';
  private readonly tokenEndpoint = 'https://api.instagram.com/oauth/access_token';
  private readonly graphBaseUrl = 'https://graph.instagram.com';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Constructs the Instagram Login authorization URL.
   */
  buildAuthorizationUrl(state: string): string {
    const clientId =
      this.configService.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.configService.get<string>('INSTAGRAM_APP_ID');
    const redirectUri = this.configService.get<string>('INSTAGRAM_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      throw new Error(
        'INSTAGRAM_CLIENT_ID and INSTAGRAM_REDIRECT_URI must be configured in environment.',
      );
    }

    const scope =
      this.configService.get<string>('INSTAGRAM_SCOPES') ||
      'instagram_business_basic';

    const params = new URLSearchParams({
      enable_fb_login: '0',
      force_authentication: '1',
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
    });

    return `${this.authorizeBaseUrl}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for an Instagram short-lived token,
   * and optionally upgrades it to a 60-day long-lived access token.
   */
  async exchangeCode(code: string): Promise<InstagramTokenResponse> {
    const clientId =
      this.configService.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.configService.get<string>('INSTAGRAM_APP_ID');
    const clientSecret =
      this.configService.get<string>('INSTAGRAM_CLIENT_SECRET') ||
      this.configService.get<string>('INSTAGRAM_APP_SECRET');
    const redirectUri = this.configService.get<string>('INSTAGRAM_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, and INSTAGRAM_REDIRECT_URI must be configured.',
      );
    }

    const sanitizedCode = code.replace(/#_$/, '');

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: sanitizedCode,
    });

    let response: Response;
    try {
      response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: any) {
      this.logger.error(`Instagram token exchange network request failed: ${err.message}`);
      throw new Error('Failed to connect to Instagram authentication server');
    }

    if (!response.ok) {
      this.logger.error(
        `Instagram token exchange HTTP error: status ${response.status}`,
      );
      throw new Error('Instagram authentication server returned an error');
    }

    const data = await response.json();

    if (data.error_type || data.error_message || data.error) {
      const errorMsg = data.error_message || data.error_type || JSON.stringify(data.error);
      this.logger.error(`Instagram token exchange API error: ${errorMsg}`);
      throw new Error(`Instagram authorization failed: ${errorMsg}`);
    }

    if (!data.access_token) {
      throw new Error('Invalid response structure from Instagram token exchange');
    }

    const shortLivedToken = data.access_token;
    const userId = String(data.user_id || '');
    let finalToken = shortLivedToken;
    let expiresIn = 3600; // Default 1 hour for short-lived token

    // Attempt to exchange short-lived token for long-lived access token (60 days)
    try {
      const longLivedResult = await this.exchangeLongLivedToken(
        shortLivedToken,
        clientSecret,
      );
      if (longLivedResult.accessToken) {
        finalToken = longLivedResult.accessToken;
        expiresIn = longLivedResult.expiresIn ?? 5184000;
      }
    } catch (longLivedErr: any) {
      this.logger.warn(
        `Could not upgrade to Instagram long-lived token, falling back to short-lived token: ${longLivedErr.message}`,
      );
    }

    return {
      accessToken: finalToken,
      userId,
      expiresIn,
      permissions: data.permissions,
    };
  }

  /**
   * Exchanges a short-lived token for a long-lived access token (60 days).
   */
  async exchangeLongLivedToken(
    shortLivedToken: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const url = new URL(`${this.graphBaseUrl}/access_token`);
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', clientSecret);
    url.searchParams.set('access_token', shortLivedToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange long-lived token: status ${response.status}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Long-lived token exchange returned no access token');
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 5184000,
    };
  }

  /**
   * Fetches Instagram Professional Account profile details and validates account type.
   */
  async getProfile(accessToken: string): Promise<InstagramProfile> {
    const apiVersion =
      this.configService.get<string>('INSTAGRAM_API_VERSION') || 'v21.0';
    const url = new URL(`${this.graphBaseUrl}/${apiVersion}/me`);
    url.searchParams.set('fields', 'id,username,name,profile_picture_url,account_type');

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: any) {
      this.logger.error(`Instagram profile fetch network request failed: ${err.message}`);
      throw new Error('Failed to connect to Instagram Graph API');
    }

    if (!response.ok) {
      this.logger.error(`Instagram profile fetch HTTP error: status ${response.status}`);
      throw new Error('Instagram Graph API returned an error while fetching profile');
    }

    const result = await response.json();

    if (result.error) {
      const errorMsg = result.error.message || JSON.stringify(result.error);
      this.logger.error(`Instagram profile API error: ${errorMsg}`);
      throw new Error(`Failed to fetch Instagram profile: ${errorMsg}`);
    }

    if (!result.id) {
      throw new Error('Instagram profile response did not return a valid account ID');
    }

    const accountType = result.account_type ? String(result.account_type).toUpperCase() : undefined;

    // Validate Instagram Professional Account (Business or Creator)
    if (accountType && accountType === 'PERSONAL') {
      throw new Error(
        'Only Instagram Professional accounts (Business or Creator) are supported. Personal accounts are not eligible.',
      );
    }

    const username = result.username || result.name || result.id;

    return {
      platformAccountId: String(result.id),
      username,
      profileImageUrl: result.profile_picture_url ?? null,
      accountType,
      name: result.name,
    };
  }

  /**
   * Refreshes a long-lived Instagram access token before it expires.
   */
  async refreshToken(currentToken: string): Promise<PlatformTokenResult> {
    const url = new URL(`${this.graphBaseUrl}/refresh_access_token`);
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', currentToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Instagram access token');
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Instagram token refresh response returned no access token');
    }

    const expiresIn = data.expires_in ?? 5184000;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    return {
      accessToken: data.access_token,
      tokenExpiry,
    };
  }
}
