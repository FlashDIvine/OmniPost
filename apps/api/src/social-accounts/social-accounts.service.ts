import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { ConnectionStatus, Platform, SocialAccount } from '../../generated/prisma/client';
import { SocialAccountResponseDto } from './dto/social-account-response.dto';

export interface ConnectSocialAccountDto {
  platform: Platform;
  platformAccountId: string;
  username: string;
  profileImageUrl?: string | null;
  accessToken: string;
  tokenExpiry?: Date | null;
  refreshToken?: string | null;
  refreshTokenExpiry?: Date | null;
  connectionStatus?: ConnectionStatus;
}

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Retrieves all social accounts belonging to the authenticated user.
   */
  async findAllForUser(userId: string): Promise<SocialAccountResponseDto[]> {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((acc) => this.sanitize(acc));
  }

  /**
   * Retrieves a single social account by ID strictly scoped to the authenticated user.
   */
  async findOneForUser(
    id: string,
    userId: string,
  ): Promise<SocialAccountResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return this.sanitize(account);
  }

  /**
   * Disconnects / deletes a social account belonging to the authenticated user.
   */
  async disconnectForUser(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    await this.prisma.socialAccount.delete({
      where: { id: account.id },
    });

    return { message: 'Social account disconnected successfully' };
  }

  /**
   * Connects / creates a new social account with encrypted platform access token.
   * Internal / service-level method for OAuth flows and test fixtures.
   */
  async connectAccount(
    userId: string,
    data: ConnectSocialAccountDto,
  ): Promise<SocialAccountResponseDto> {
    const existing = await this.prisma.socialAccount.findUnique({
      where: {
        platform_platformAccountId: {
          platform: data.platform,
          platformAccountId: data.platformAccountId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `This ${data.platform} account (${data.username}) is already connected`,
      );
    }

    const encryptedAccessToken = this.cryptoService.encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken
      ? this.cryptoService.encrypt(data.refreshToken)
      : null;

    const account = await this.prisma.socialAccount.create({
      data: {
        platform: data.platform,
        platformAccountId: data.platformAccountId,
        username: data.username,
        profileImageUrl: data.profileImageUrl ?? null,
        accessToken: encryptedAccessToken,
        tokenExpiry: data.tokenExpiry ?? null,
        refreshToken: encryptedRefreshToken,
        refreshTokenExpiry: data.refreshTokenExpiry ?? null,
        connectionStatus: data.connectionStatus ?? ConnectionStatus.CONNECTED,
        userId,
      },
    });

    return this.sanitize(account);
  }

  /**
   * Decrypts and retrieves the raw platform access token for publishing and platform API calls.
   * Internal domain method strictly scoped by user ownership.
   */
  async getDecryptedAccessToken(
    id: string,
    userId: string,
  ): Promise<string> {
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return this.cryptoService.decrypt(account.accessToken);
  }

  /**
   * Strips all credentials and returns the sanitized public DTO.
   */
  sanitize(account: SocialAccount): SocialAccountResponseDto {
    return {
      id: account.id,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      username: account.username,
      profileImageUrl: account.profileImageUrl,
      tokenExpiry: account.tokenExpiry,
      connectionStatus: account.connectionStatus,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
