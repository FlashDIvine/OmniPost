import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class InstagramCallbackDto {
  @ApiPropertyOptional({
    description: 'Authorization code returned by Instagram upon successful authorization',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Cryptographically secure state parameter returned by Instagram',
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
    description: 'Reason code for the OAuth error',
  })
  @IsOptional()
  @IsString()
  error_reason?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the OAuth error',
  })
  @IsOptional()
  @IsString()
  error_description?: string;
}
