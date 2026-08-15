import { ApiProperty } from '@nestjs/swagger';

export class OAuthConnectResponseDto {
  @ApiProperty({
    example: 'https://www.tiktok.com/v2/auth/authorize/?client_key=...',
    description: 'The platform OAuth authorization URL to redirect the user to',
  })
  url: string;
}
