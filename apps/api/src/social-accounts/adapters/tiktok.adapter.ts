import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '../../../generated/prisma/client';
import {
  PlatformAdapter,
  PlatformProfile,
  PlatformTokenResult,
} from './platform-adapter.interface';

export interface TikTokTokenResponse {
  accessToken: string;
  expiresIn: number;
  openId: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  scope?: string;
  tokenType?: string;
}

@Injectable()
export class TikTokAdapter implements PlatformAdapter {
  readonly platform = Platform.TIKTOK;
  private readonly logger = new Logger(TikTokAdapter.name);

  private readonly authorizeBaseUrl = 'https://www.tiktok.com/v2/auth/authorize/';
  private readonly tokenEndpoint = 'https://open.tiktokapis.com/v2/oauth/token/';
  private readonly userInfoEndpoint = 'https://open.tiktokapis.com/v2/user/info/';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Constructs the TikTok OAuth v2 authorization URL.
   */
  buildAuthorizationUrl(state: string): string {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI');

    if (!clientKey || !redirectUri) {
      throw new Error(
        'TIKTOK_CLIENT_KEY and TIKTOK_REDIRECT_URI must be configured in environment.',
      );
    }

    const scope =
      this.configService.get<string>('TIKTOK_SCOPES') ||
      'user.info.basic,user.info.profile';

    const params = new URLSearchParams({
      client_key: clientKey,
      scope,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });

    return `${this.authorizeBaseUrl}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for TikTok access and refresh tokens.
   */
  async exchangeCode(code: string): Promise<TikTokTokenResponse> {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI');

    if (!clientKey || !clientSecret || !redirectUri) {
      throw new Error(
        'TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI must be configured.',
      );
    }

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    let response: Response;
    try {
      response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: any) {
      this.logger.error(`TikTok token exchange network request failed: ${err.message}`);
      throw new Error('Failed to connect to TikTok authentication server');
    }

    if (!response.ok) {
      this.logger.error(
        `TikTok token exchange HTTP error: status ${response.status}`,
      );
      throw new Error('TikTok authentication server returned an error');
    }

    const data = await response.json();

    if (data.error && data.error.code !== 'ok' && data.error.code !== 0 && data.error.code !== '0') {
      const errorMsg = data.error.message || data.error.code;
      this.logger.error(`TikTok token exchange API error: ${errorMsg}`);
      throw new Error(`TikTok authorization failed: ${errorMsg}`);
    }

    const tokenData = data.data || data;
    if (!tokenData || !tokenData.access_token) {
      throw new Error('Invalid response structure from TikTok token exchange');
    }

    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in ?? 86400,
      openId: tokenData.open_id,
      refreshToken: tokenData.refresh_token,
      refreshExpiresIn: tokenData.refresh_expires_in,
      scope: tokenData.scope,
      tokenType: tokenData.token_type,
    };
  }

  /**
   * Fetches user profile information using the TikTok Display API v2.
   */
  async getProfile(accessToken: string): Promise<PlatformProfile> {
    const url = new URL(this.userInfoEndpoint);
    url.searchParams.set(
      'fields',
      'open_id,union_id,avatar_url,display_name,username',
    );

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
      this.logger.error(`TikTok profile fetch network request failed: ${err.message}`);
      throw new Error('Failed to connect to TikTok API');
    }

    if (!response.ok) {
      this.logger.error(`TikTok profile fetch HTTP error: status ${response.status}`);
      throw new Error('TikTok API returned an error while fetching profile');
    }

    const result = await response.json();

    if (result.error && result.error.code !== 'ok' && result.error.code !== 0 && result.error.code !== '0') {
      const errorMsg = result.error.message || result.error.code;
      this.logger.error(`TikTok profile API error: ${errorMsg}`);
      throw new Error(`Failed to fetch TikTok profile: ${errorMsg}`);
    }

    const user = result.data?.user || result.data || {};
    const platformAccountId = user.open_id || user.union_id;
    if (!platformAccountId) {
      throw new Error('TikTok profile did not return a valid account ID');
    }

    const username = user.username || user.display_name || platformAccountId;

    return {
      platformAccountId,
      username,
      profileImageUrl: user.avatar_url ?? null,
    };
  }

  /**
   * Refreshes TikTok access token using refresh_token.
   */
  async refreshToken(
    _currentToken: string,
    refreshToken?: string,
  ): Promise<PlatformTokenResult> {
    if (!refreshToken) {
      throw new Error('Refresh token is required to refresh TikTok credentials');
    }

    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');

    if (!clientKey || !clientSecret) {
      throw new Error('TikTok client credentials must be configured');
    }

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh TikTok access token');
    }

    const data = await response.json();
    const tokenData = data.data || data;

    const expiresIn = tokenData.expires_in ?? 86400;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    return {
      accessToken: tokenData.access_token,
      tokenExpiry,
      refreshToken: tokenData.refresh_token ?? refreshToken,
    };
  }
}
