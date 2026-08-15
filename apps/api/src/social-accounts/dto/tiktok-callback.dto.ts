import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TikTokCallbackDto {
  @ApiPropertyOptional({
    description: 'Authorization code returned by TikTok upon successful authorization',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Cryptographically secure state parameter returned by TikTok',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'OAuth error identifier if user denied or authorization failed',
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the OAuth error',
  })
  @IsOptional()
  @IsString()
  error_description?: string;
}
