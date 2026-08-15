import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { JwtPayload, JwtRefreshPayload } from './types/jwt-payload.type';
import { User } from '../../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    user: UserResponseDto;
    accessToken: string;
    refreshToken: string;
  }> {
    const existingUser = await this.usersService.findByUsername(dto.username);
    if (existingUser) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await hash(dto.password);
    const user = await this.usersService.create({
      username: dto.username,
      passwordHash,
    });

    const tokens = await this.generateTokens(user.id, user.username);
    const hashedRefreshToken = await hash(tokens.refreshToken);
    await this.usersService.updateHashedRefreshToken(
      user.id,
      hashedRefreshToken,
    );

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto): Promise<{
    user: UserResponseDto;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isPasswordValid = await verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const tokens = await this.generateTokens(user.id, user.username);
    const hashedRefreshToken = await hash(tokens.refreshToken);
    await this.usersService.updateHashedRefreshToken(
      user.id,
      hashedRefreshToken,
    );

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshToken(refreshTokenStr: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!refreshTokenStr) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'omnipost-dev-jwt-refresh-secret-32-chars-key';

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshTokenStr,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access revoked, please log in again');
    }

    const isTokenValid = await verify(
      user.hashedRefreshToken,
      refreshTokenStr,
    );
    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.username);
    const hashedRefreshToken = await hash(tokens.refreshToken);
    await this.usersService.updateHashedRefreshToken(
      user.id,
      hashedRefreshToken,
    );

    return tokens;
  }

  async logout(userId?: string): Promise<{ message: string }> {
    if (userId) {
      await this.usersService.updateHashedRefreshToken(userId, null);
    }
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  sanitizeUser(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async generateTokens(
    userId: string,
    username: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'omnipost-dev-jwt-access-secret-32-chars-key';
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'omnipost-dev-jwt-refresh-secret-32-chars-key';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const accessPayload: JwtPayload = { sub: userId, username };
    const refreshPayload: JwtRefreshPayload = { sub: userId, jti: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
