import { ApiProperty } from '@nestjs/swagger';
import { ConnectionStatus, Platform } from '../../../generated/prisma/client';

export class SocialAccountResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique identifier for the connected social account (UUID)',
  })
  id: string;

  @ApiProperty({
    enum: Platform,
    example: Platform.INSTAGRAM,
    description: 'Social media platform (INSTAGRAM, TIKTOK)',
  })
  platform: Platform;

  @ApiProperty({
    example: '17841400000000000',
    description: 'Unique user/account ID on the target platform',
  })
  platformAccountId: string;

  @ApiProperty({
    example: 'omnipost_official',
    description: 'Account username on the target platform',
  })
  username: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
    description: 'Profile image URL on the target platform',
  })
  profileImageUrl: string | null;

  @ApiProperty({
    example: '2026-10-15T12:00:00.000Z',
    nullable: true,
    description: 'Platform access token expiry date (if applicable)',
  })
  tokenExpiry: Date | null;

  @ApiProperty({
    enum: ConnectionStatus,
    example: ConnectionStatus.CONNECTED,
    description: 'Current connection status (CONNECTED, DISCONNECTED, EXPIRED)',
  })
  connectionStatus: ConnectionStatus;

  @ApiProperty({
    example: '2026-08-16T00:00:00.000Z',
    description: 'Connection creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-16T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
