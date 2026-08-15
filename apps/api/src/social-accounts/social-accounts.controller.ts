import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SocialAccountsService } from './social-accounts.service';
import { TikTokOAuthService } from './services/tiktok-oauth.service';
import { InstagramOAuthService } from './services/instagram-oauth.service';
import { SocialAccountResponseDto } from './dto/social-account-response.dto';
import { OAuthConnectResponseDto } from './dto/oauth-connect-response.dto';
import { TikTokCallbackDto } from './dto/tiktok-callback.dto';
import { InstagramCallbackDto } from './dto/instagram-callback.dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

@ApiTags('Social Accounts')
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(
    private readonly socialAccountsService: SocialAccountsService,
    private readonly tikTokOAuthService: TikTokOAuthService,
    private readonly instagramOAuthService: InstagramOAuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all connected social accounts for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of connected social accounts',
    type: [SocialAccountResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findAll(
    @CurrentUser() user: AuthUser,
  ): Promise<SocialAccountResponseDto[]> {
    return this.socialAccountsService.findAllForUser(user.userId);
  }

  @Get('tiktok/connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate TikTok Login Kit connection and retrieve authorization URL',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the TikTok authorization URL with secure state',
    type: OAuthConnectResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async connectTikTok(
    @CurrentUser() user: AuthUser,
  ): Promise<OAuthConnectResponseDto> {
    return this.tikTokOAuthService.getConnectUrl(user.userId);
  }

  @Get('tiktok/callback')
  @ApiOperation({
    summary: 'TikTok OAuth v2 authorization callback handler',
  })
  @ApiFoundResponse({
    description: 'Redirects to the configured frontend application with connection status',
  })
  async tikTokCallback(
    @Query() query: TikTokCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    const { redirectUrl } = await this.tikTokOAuthService.handleCallback(query);
    return res.redirect(redirectUrl);
  }

  @Get('instagram/connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate Instagram Login connection and retrieve authorization URL',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the Instagram authorization URL with secure state',
    type: OAuthConnectResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async connectInstagram(
    @CurrentUser() user: AuthUser,
  ): Promise<OAuthConnectResponseDto> {
    return this.instagramOAuthService.getConnectUrl(user.userId);
  }

  @Get('instagram/callback')
  @ApiOperation({
    summary: 'Instagram Login authorization callback handler',
  })
  @ApiFoundResponse({
    description: 'Redirects to the configured frontend application with connection status',
  })
  async instagramCallback(
    @Query() query: InstagramCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    const { redirectUrl } = await this.instagramOAuthService.handleCallback(query);
    return res.redirect(redirectUrl);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a single connected social account by ID' })
  @ApiParam({
    name: 'id',
    description: 'Social account ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Connected social account details',
    type: SocialAccountResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Social account not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SocialAccountResponseDto> {
    return this.socialAccountsService.findOneForUser(id, user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect / delete a connected social account' })
  @ApiParam({
    name: 'id',
    description: 'Social account ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Social account disconnected successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Social account not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async disconnect(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageResponseDto> {
    return this.socialAccountsService.disconnectForUser(id, user.userId);
  }
}
