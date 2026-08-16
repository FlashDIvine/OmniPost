import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateMediaDto } from './create-media.dto';

export class CreatePostDto {
  @ApiPropertyOptional({
    example: 'Check out our latest product release! #OmniPost #Launch',
    description: 'Post text caption / description (up to 2200 characters)',
    maxLength: 2200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Target connected social account ID (UUID) belonging to authenticated user',
  })
  @IsUUID('4', {
    message: 'socialAccountId must be a valid UUID v4',
  })
  @IsNotEmpty()
  socialAccountId: string;

  @ApiPropertyOptional({
    example: 'uploads/2026/08/custom_cover.jpg',
    description: 'Optional custom cover image / thumbnail path for video or post',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cover?: string;

  @ApiPropertyOptional({
    type: [CreateMediaDto],
    description: 'Optional list of media assets associated with the post',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaDto)
  media?: CreateMediaDto[];
}
