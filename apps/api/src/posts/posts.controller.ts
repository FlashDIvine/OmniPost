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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { MediaResponseDto } from './dto/media-response.dto';
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

  @Post(':id/media')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB default limit
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a media asset (JPEG, PNG, WebP, MP4) for an existing post',
  })
  @ApiParam({
    name: 'id',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Media file binary (JPEG, PNG, WebP, MP4, up to 50MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Media uploaded and linked successfully',
    type: MediaResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Post not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async uploadMedia(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MediaResponseDto> {
    return this.postsService.uploadMedia(id, user.userId, file);
  }

  @Get(':postId/media/:mediaId')
  @ApiOperation({
    summary: 'Stream / retrieve an authenticated media file',
  })
  @ApiParam({
    name: 'postId',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'mediaId',
    description: 'Media identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiOkResponse({
    description: 'Streams the media binary',
  })
  @ApiNotFoundResponse({ description: 'Post or media not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getMedia(
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.postsService.getMediaStream(
      postId,
      mediaId,
      user.userId,
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.fileSize);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.send(file.buffer);
  }

  @Delete(':postId/media/:mediaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a media asset from a post',
  })
  @ApiParam({
    name: 'postId',
    description: 'Post identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'mediaId',
    description: 'Media identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiOkResponse({
    description: 'Media deleted successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Post or media not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async removeMedia(
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageResponseDto> {
    return this.postsService.deleteMedia(postId, mediaId, user.userId);
  }
}
