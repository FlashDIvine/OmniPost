import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { PublishingService } from './publishing.service';
import { PublishResponseDto } from './dto/publish-response.dto';
import { PublishAttemptResponseDto } from './dto/publish-attempt-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

@ApiTags('Publishing')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish a draft post to its target social platform',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Publishing pipeline executed and state finalized',
    type: PublishResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Post not found or not owned by user' })
  @ApiConflictResponse({
    description:
      'Post is already being published, has already been published, or has invalid state',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Publishing preconditions failed (e.g. missing media, disconnected account, missing storage file)',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PublishResponseDto> {
    return this.publishingService.publishPost(id, user.userId);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry publishing a post currently in FAILED status',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Retry executed and new attempt created',
    type: PublishResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Post not found or not owned by user' })
  @ApiConflictResponse({
    description: 'Post is not in FAILED status or is already publishing',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Publishing preconditions failed on retry',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PublishResponseDto> {
    return this.publishingService.retryPublish(id, user.userId);
  }

  @Get(':id/attempts')
  @ApiOperation({
    summary: 'Retrieve all historical publish attempts for a post',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'List of historical publish attempts for the post',
    type: [PublishAttemptResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Post not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getAttempts(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PublishAttemptResponseDto[]> {
    return this.publishingService.getPublishAttemptsForPost(id, user.userId);
  }
}
