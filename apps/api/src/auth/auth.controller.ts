import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  MessageResponseDto,
  RefreshResponseDto,
} from './dto/auth-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './types/auth-user.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({ description: 'Username is already taken' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with username and password' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh short-lived access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken =
      req.cookies?.['refreshToken'] ||
      (req.headers['x-refresh-token'] as string) ||
      (req.body?.refreshToken as string);

    const tokens = await this.authService.refreshToken(refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out user and revoke refresh token' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    type: MessageResponseDto,
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const refreshToken =
      req.cookies?.['refreshToken'] ||
      (req.headers['x-refresh-token'] as string) ||
      (req.body?.refreshToken as string);

    if (refreshToken) {
      try {
        const refreshSecret =
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'omnipost-dev-jwt-refresh-secret-32-chars-key';
        // Attempt to extract userId from token for revocation
        const payload = JSON.parse(
          Buffer.from(refreshToken.split('.')[1], 'base64').toString(),
        );
        if (payload?.sub) {
          await this.authService.logout(payload.sub);
        }
      } catch {
        // Continue clearing cookie even if token decode fails
      }
    }

    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user profile',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getMe(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.authService.getMe(user.userId);
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProd =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    const isProd =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
    });
  }
}
