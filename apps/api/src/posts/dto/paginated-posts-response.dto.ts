import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';

export class PaginationMetaDto {
  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    example: 25,
    description: 'Total number of items matching the query',
  })
  totalItems: number;

  @ApiProperty({
    example: 3,
    description: 'Total number of pages',
  })
  totalPages: number;

  @ApiProperty({
    example: true,
    description: 'Whether there is a subsequent page',
  })
  hasNextPage: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether there is a preceding page',
  })
  hasPreviousPage: boolean;
}

export class PaginatedPostsResponseDto {
  @ApiProperty({
    type: [PostResponseDto],
    description: 'List of posts on the current page',
  })
  data: PostResponseDto[];

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Pagination metadata',
  })
  meta: PaginationMetaDto;
}
