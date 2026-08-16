import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginatedPostsResponseDto } from './dto/paginated-posts-response.dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

@ApiTags('Posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new draft post with optional media assets',
  })
  @ApiCreatedResponse({
    description: 'Post created successfully',
    type: PostResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Target social account not found or does not belong to the user',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createPostDto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.postsService.create(user.userId, createPostDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List paginated posts belonging to authenticated user',
  })
  @ApiOkResponse({
    description: 'Paginated list of posts',
    type: PaginatedPostsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: PostsQueryDto,
  ): Promise<PaginatedPostsResponseDto> {
    return this.postsService.findAllForUser(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details of a single post by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Post details with relations',
    type: PostResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Post not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PostResponseDto> {
    return this.postsService.findOneForUser(id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update post caption, cover, target social account, or media',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Post updated successfully',
    type: PostResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Post or new target social account not found',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
    @Body() updatePostDto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.postsService.updateForUser(id, user.userId, updatePostDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a post and its associated media assets',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Post deleted successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Post not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageResponseDto> {
    return this.postsService.deleteForUser(id, user.userId);
  }
}
