import { Platform } from '../../../generated/prisma/client';

export interface PlatformProfile {
  platformAccountId: string;
  username: string;
  profileImageUrl?: string | null;
}

export interface PlatformTokenResult {
  accessToken: string;
  tokenExpiry?: Date | null;
  refreshToken?: string | null;
}

export interface PlatformAdapter {
  readonly platform: Platform;

  /**
   * Fetches user profile information from the platform using the decrypted access token.
   */
  getProfile(accessToken: string): Promise<PlatformProfile>;

  /**
   * Refreshes the platform access token (if supported by the platform).
   */
  refreshToken?(
    currentToken: string,
    refreshToken?: string,
  ): Promise<PlatformTokenResult>;

  /**
   * Revokes or disconnects the platform integration.
   */
  disconnect?(accessToken: string): Promise<void>;
}
