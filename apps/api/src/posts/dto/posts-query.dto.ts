import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PostStatus } from '../../../generated/prisma/client';

export class PostsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination (starts at 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page (maximum 50)',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @ApiPropertyOptional({
    enum: PostStatus,
    example: PostStatus.DRAFT,
    description: 'Filter posts by status (DRAFT, PUBLISHING, PUBLISHED, FAILED)',
  })
  @IsOptional()
  @IsEnum(PostStatus, {
    message: 'status must be one of: DRAFT, PUBLISHING, PUBLISHED, FAILED',
  })
  status?: PostStatus;
}
