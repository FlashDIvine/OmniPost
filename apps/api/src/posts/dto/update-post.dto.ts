import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateMediaDto } from './create-media.dto';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Updated post caption text #OmniPost',
    description: 'Updated caption for the post (up to 2200 characters)',
    maxLength: 2200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Target connected social account ID (UUID) belonging to authenticated user',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'socialAccountId must be a valid UUID v4',
  })
  socialAccountId?: string;

  @ApiPropertyOptional({
    example: 'uploads/2026/08/new_cover.jpg',
    description: 'Updated custom cover image / thumbnail path',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cover?: string;

  @ApiPropertyOptional({
    type: [CreateMediaDto],
    description: 'Updated list of media assets (replaces existing post media)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaDto)
  media?: CreateMediaDto[];
}
