import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConnectionStatus, Platform } from '../../../generated/prisma/client';
import { OAuthStateService } from './oauth-state.service';
import { InstagramAdapter } from '../adapters/instagram.adapter';

export interface InstagramCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_reason?: string;
  error_description?: string;
}

@Injectable()
export class InstagramOAuthService {
  private readonly logger = new Logger(InstagramOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly oAuthStateService: OAuthStateService,
    private readonly instagramAdapter: InstagramAdapter,
  ) {}

  /**
   * Generates a single-use OAuth state and returns the Instagram authorization URL for the user.
   */
  async getConnectUrl(userId: string): Promise<{ url: string }> {
    const state = await this.oAuthStateService.generateState(
      userId,
      Platform.INSTAGRAM,
    );

    const url = this.instagramAdapter.buildAuthorizationUrl(state);
    return { url };
  }

  /**
   * Handles the Instagram OAuth callback, validates state, exchanges authorization code,
   * fetches and validates Instagram Professional Account, encrypts tokens, persists SocialAccount,
   * and returns the safe redirect URL.
   */
  async handleCallback(
    query: InstagramCallbackQuery,
  ): Promise<{ redirectUrl: string }> {
    const successBase =
      this.configService.get<string>('OAUTH_SUCCESS_REDIRECT') ||
      'http://localhost:3000/social-accounts?status=success';
    const errorBase =
      this.configService.get<string>('OAUTH_ERROR_REDIRECT') ||
      'http://localhost:3000/social-accounts?status=error';

    // 1. Handle user denied / OAuth error returned by Meta
    if (query.error) {
      this.logger.warn(
        `Instagram OAuth denied: ${query.error} (${query.error_reason}) - ${query.error_description}`,
      );
      if (query.state) {
        try {
          await this.oAuthStateService.validateAndConsumeState(
            query.state,
            Platform.INSTAGRAM,
          );
        } catch {
          // Ignore state error if user denied
        }
      }
      return {
        redirectUrl: this.buildRedirectUrl(errorBase, {
          error: query.error,
          error_description:
            query.error_description || query.error_reason || 'Instagram connection was denied',
        }),
      };
    }

    // 2. Validate presence of code and state
    if (!query.code || !query.state) {
      return {
        redirectUrl: this.buildRedirectUrl(errorBase, {
          error: 'missing_parameters',
          error_description: 'Missing code or state in Instagram callback',
        }),
      };
    }

    try {
      // 3. Validate and atomically consume state (single-use)
      const { userId } = await this.oAuthStateService.validateAndConsumeState(
        query.state,
        Platform.INSTAGRAM,
      );

      // 4. Exchange authorization code for tokens
      const tokenResult = await this.instagramAdapter.exchangeCode(query.code);

      // 5. Fetch Instagram profile and validate professional account
      const profile = await this.instagramAdapter.getProfile(tokenResult.accessToken);

      // 6. Calculate token expiration timestamp
      const tokenExpiry = tokenResult.expiresIn
        ? new Date(Date.now() + tokenResult.expiresIn * 1000)
        : null;

      // 7. Encrypt access token
      const encryptedAccessToken = this.cryptoService.encrypt(
        tokenResult.accessToken,
      );

      // 8. Handle duplicate / account ownership logic
      const existing = await this.prisma.socialAccount.findUnique({
        where: {
          platform_platformAccountId: {
            platform: Platform.INSTAGRAM,
            platformAccountId: profile.platformAccountId,
          },
        },
      });

      let accountId: string;

      if (existing) {
        // Enforce ownership: reject if account is already linked to another OmniPost user
        if (existing.userId !== userId) {
          this.logger.warn(
            `Instagram account ${profile.platformAccountId} is already connected to another user`,
          );
          return {
            redirectUrl: this.buildRedirectUrl(errorBase, {
              error: 'account_already_connected_to_another_user',
              error_description:
                'This Instagram account is already linked to another OmniPost user',
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
            connectionStatus: ConnectionStatus.CONNECTED,
          },
        });
        accountId = updated.id;
      } else {
        // Create new SocialAccount record
        const created = await this.prisma.socialAccount.create({
          data: {
            platform: Platform.INSTAGRAM,
            platformAccountId: profile.platformAccountId,
            username: profile.username,
            profileImageUrl: profile.profileImageUrl,
            accessToken: encryptedAccessToken,
            tokenExpiry,
            connectionStatus: ConnectionStatus.CONNECTED,
            userId,
          },
        });
        accountId = created.id;
      }

      return {
        redirectUrl: this.buildRedirectUrl(successBase, {
          platform: 'instagram',
          accountId,
        }),
      };
    } catch (err: any) {
      this.logger.error(`Instagram OAuth callback processing error: ${err.message}`);
      return {
        redirectUrl: this.buildRedirectUrl(errorBase, {
          error: 'oauth_processing_failed',
          error_description:
            err.message || 'Failed to complete Instagram connection',
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
