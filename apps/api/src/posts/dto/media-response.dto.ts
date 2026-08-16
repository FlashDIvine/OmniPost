import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../../../generated/prisma/client';

export class MediaResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique identifier for the media asset (UUID)',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID of the associated post (UUID)',
  })
  postId: string;

  @ApiProperty({
    enum: MediaType,
    example: MediaType.IMAGE,
    description: 'Domain content type of the media asset',
  })
  mediaType: MediaType;

  @ApiProperty({
    example: 'photo1.jpg',
    description: 'Original file name',
  })
  fileName: string;

  @ApiProperty({
    example: 'uploads/2026/08/photo1.jpg',
    description: 'Storage file path',
  })
  filePath: string;

  @ApiProperty({
    example: 1048576,
    description: 'File size in bytes',
  })
  fileSize: number;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type of the media',
  })
  mimeType: string;

  @ApiProperty({
    example: 0,
    description: 'Sort order index in carousel / multi-asset posts',
  })
  sortOrder: number;

  @ApiProperty({
    example: '2026-08-16T00:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-16T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
