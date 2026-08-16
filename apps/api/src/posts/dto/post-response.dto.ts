import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '../../../generated/prisma/client';
import { SocialAccountResponseDto } from '../../social-accounts/dto/social-account-response.dto';
import { MediaResponseDto } from './media-response.dto';

export class PostResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique post identifier (UUID)',
  })
  id: string;

  @ApiProperty({
    example: 'Check out our latest product release! #OmniPost #Launch',
    nullable: true,
    description: 'Post text caption / description',
  })
  caption: string | null;

  @ApiProperty({
    enum: PostStatus,
    example: PostStatus.DRAFT,
    description: 'Current post lifecycle status (DRAFT, PUBLISHING, PUBLISHED, FAILED)',
  })
  status: PostStatus;

  @ApiProperty({
    example: 'uploads/2026/08/custom_cover.jpg',
    nullable: true,
    description: 'Custom cover image / thumbnail path',
  })
  cover: string | null;

  @ApiProperty({
    example: 'https://instagram.com/p/Cxyz123',
    nullable: true,
    description: 'External URL of the published post on the social network',
  })
  publishedUrl: string | null;

  @ApiProperty({
    example: '2026-08-16T12:00:00.000Z',
    nullable: true,
    description: 'Timestamp when the post was successfully published',
  })
  publishedAt: Date | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID of the targeted social account (UUID)',
  })
  socialAccountId: string;

  @ApiProperty({
    type: SocialAccountResponseDto,
    description: 'Sanitized target social account details (no credentials)',
  })
  socialAccount: SocialAccountResponseDto;

  @ApiProperty({
    type: [MediaResponseDto],
    description: 'List of media assets attached to the post ordered by sortOrder',
  })
  media: MediaResponseDto[];

  @ApiProperty({
    example: '2026-08-16T00:00:00.000Z',
    description: 'Post creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-16T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
