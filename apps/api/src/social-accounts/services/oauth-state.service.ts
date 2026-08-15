import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '../../../generated/prisma/client';

@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);
  private readonly stateTtlMs = 10 * 60 * 1000; // 10 minutes

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates and stores a cryptographically secure random state associated with the authenticated user.
   */
  async generateState(userId: string, platform: Platform): Promise<string> {
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.stateTtlMs);

    await this.prisma.oAuthState.create({
      data: {
        state,
        platform,
        userId,
        expiresAt,
      },
    });

    return state;
  }

  /**
   * Validates that the state exists, matches the expected platform, is not expired,
   * and has not been consumed yet. Marks the state as consumed immediately (single-use).
   */
  async validateAndConsumeState(
    state: string,
    platform: Platform,
  ): Promise<{ userId: string }> {
    if (!state || typeof state !== 'string') {
      throw new BadRequestException('Missing or invalid OAuth state parameter');
    }

    const record = await this.prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!record) {
      this.logger.warn('OAuth state verification failed: state not found');
      throw new BadRequestException('Invalid OAuth state parameter');
    }

    if (record.platform !== platform) {
      this.logger.warn('OAuth state verification failed: platform mismatch');
      throw new BadRequestException('OAuth state platform mismatch');
    }

    if (record.consumedAt !== null) {
      this.logger.warn('OAuth state verification failed: state already consumed');
      throw new BadRequestException('OAuth state has already been used');
    }

    if (record.expiresAt < new Date()) {
      this.logger.warn('OAuth state verification failed: state expired');
      throw new BadRequestException('OAuth state has expired');
    }

    // Atomically mark consumed
    await this.prisma.oAuthState.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return { userId: record.userId };
  }
}
