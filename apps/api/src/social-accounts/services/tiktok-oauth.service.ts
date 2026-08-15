import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConnectionStatus, Platform } from '../../../generated/prisma/client';
import { OAuthStateService } from './oauth-state.service';
import { TikTokAdapter } from '../adapters/tiktok.adapter';

export interface TikTokCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

@Injectable()
export class TikTokOAuthService {
  private readonly logger = new Logger(TikTokOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly oAuthStateService: OAuthStateService,
    private readonly tikTokAdapter: TikTokAdapter,
  ) {}

  /**
   * Generates a single-use OAuth state and returns the TikTok authorization URL for the user.
   */
  async getConnectUrl(userId: string): Promise<{ url: string }> {
    const state = await this.oAuthStateService.generateState(
      userId,
      Platform.TIKTOK,
    );

    const url = this.tikTokAdapter.buildAuthorizationUrl(state);
    return { url };
  }

  /**
   * Handles the TikTok OAuth callback, validates state, exchanges authorization code,
   * fetches user profile, encrypts tokens, persists SocialAccount, and returns the redirect URL.
   */
  async handleCallback(
    query: TikTokCallbackQuery,
  ): Promise<{ redirectUrl: string }> {
    const successBase =
      this.configService.get<string>('OAUTH_SUCCESS_REDIRECT') ||
      'http://localhost:3000/social-accounts?status=success';
    const errorBase =
      this.configService.get<string>('OAUTH_ERROR_REDIRECT') ||
      'http://localhost:3000/social-accounts?status=error';

    // 1. Handle user denied / OAuth error returned by TikTok
    if (query.error) {
      this.logger.warn(`TikTok OAuth denied: ${query.error} - ${query.error_description}`);
      if (query.state) {
        try {
          await this.oAuthStateService.validateAndConsumeState(
            query.state,
            Platform.TIKTOK,
          );
        } catch {
          // Ignore state error if user denied
        }
      }
      return {
        redirectUrl: this.buildRedirectUrl(errorBase, {
          error: query.error,
          error_description: query.error_description || 'TikTok connection was denied',
        }),
      };
    }

    // 2. Validate presence of code and state
    if (!query.code || !query.state) {
      return {
        redirectUrl: this.buildRedirectUrl(errorBase, {
          error: 'missing_parameters',
          error_description: 'Missing code or state in TikTok callback',
        }),
      };
    }

    try {
      // 3. Validate and atomically consume state (single-use)
      const { userId } = await this.oAuthStateService.validateAndConsumeState(
        query.state,
        Platform.TIKTOK,
      );

      // 4. Exchange authorization code for tokens
      const tokenResult = await this.tikTokAdapter.exchangeCode(query.code);

      // 5. Fetch user profile from TikTok API
      const profile = await this.tikTokAdapter.getProfile(tokenResult.accessToken);

      // 6. Calculate token expiration timestamps
      const tokenExpiry = new Date(
        Date.now() + (tokenResult.expiresIn ?? 86400) * 1000,
      );
      const refreshTokenExpiry = tokenResult.refreshExpiresIn
        ? new Date(Date.now() + tokenResult.refreshExpiresIn * 1000)
        : null;

      // 7. Encrypt access token and refresh token
      const encryptedAccessToken = this.cryptoService.encrypt(
        tokenResult.accessToken,
      );
      const encryptedRefreshToken = tokenResult.refreshToken
        ? this.cryptoService.encrypt(tokenResult.refreshToken)
        : null;

      // 8. Handle duplicate / account ownership logic
      const existing = await this.prisma.socialAccount.findUnique({
        where: {
          platform_platformAccountId: {
            platform: Platform.TIKTOK,
            platformAccountId: profile.platformAccountId,
          },
        },
      });

      let accountId: string;

      if (existing) {
        // Enforce ownership: reject if account is already linked to another OmniPost user
        if (existing.userId !== userId) {
          this.logger.warn(
            `TikTok account ${profile.platformAccountId} is already connected to another user`,
          );
          return {
            redirectUrl: this.buildRedirectUrl(errorBase, {
              error: 'account_already_connected_to_another_user',
              error_description:
                'This TikTok account is already linked to another OmniPost user',
            }),
          };
        }

        // Reconnect / update credentials for the same user
        const updated = await this.prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            username: profile.username,
            profileImageUrl: profile.profileImageUrl,
            accessToken: encryptedAccessToken,
            tokenExpiry,
            refreshToken: encryptedRefreshToken,
            refreshTokenExpiry,
            connectionStatus: ConnectionStatus.CONNECTED,
          },
        });
        accountId = updated.id;
      } else {
        // Create new SocialAccount record
        const created = await this.prisma.socialAccount.create({
          data: {
            platform: Platform.TIKTOK,
            platformAccountId: profile.platformAccountId,
            username: profile.username,
            profileImageUrl: profile.profileImageUrl,
            accessToken: encryptedAccessToken,
            tokenExpiry,
            refreshToken: encryptedRefreshToken,
            refreshTokenExpiry,
            connectionStatus: ConnectionStatus.CONNECTED,
            userId,
          },
        });
        accountId = created.id;
      }

      return {
        redirectUrl: this.buildRedirectUrl(successBase, {
          platform: 'tiktok',
          accountId,
        }),
      };
    } catch (err: any) {
      this.logger.error(`TikTok OAuth callback processing error: ${err.message}`);
      return {
        redirectUrl: this.buildRedirectUrl(errorBase, {
          error: 'oauth_processing_failed',
          error_description: err.message || 'Failed to complete TikTok connection',
        }),
      };
    }
  }

  /**
   * Safely appends query parameters to a base redirect URL without allowing open redirects.
   */
  private buildRedirectUrl(
    baseUrl: string,
    params: Record<string, string>,
  ): string {
    try {
      const url = new URL(baseUrl);
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          url.searchParams.set(key, value);
        }
      }
      return url.toString();
    } catch {
      return baseUrl;
    }
  }
}
