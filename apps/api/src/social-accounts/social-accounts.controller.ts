import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SocialAccountsService } from './social-accounts.service';
import { SocialAccountResponseDto } from './dto/social-account-response.dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

@ApiTags('Social Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get()
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

  @Get(':id')
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
