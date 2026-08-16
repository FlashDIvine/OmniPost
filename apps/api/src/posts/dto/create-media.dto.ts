import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MediaType } from '../../../generated/prisma/client';

export class CreateMediaDto {
  @ApiProperty({
    enum: MediaType,
    example: MediaType.IMAGE,
    description: 'Domain content type of the media asset (IMAGE or VIDEO)',
  })
  @IsEnum(MediaType, {
    message: 'mediaType must be one of: IMAGE, VIDEO',
  })
  @IsNotEmpty()
  mediaType: MediaType;

  @ApiProperty({
    example: 'photo1.jpg',
    description: 'Original file name of the media asset',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    example: 'uploads/2026/08/photo1.jpg',
    description: 'Logical storage path or identifier for the asset',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  filePath: string;

  @ApiProperty({
    example: 1048576,
    description: 'File size in bytes',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  fileSize: number;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type of the media file',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Zero-based sort order for carousels / multi-asset posts',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
