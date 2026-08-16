import { ApiProperty } from '@nestjs/swagger';
import { PublishAttemptStatus } from '../../../generated/prisma/client';

export class PublishAttemptResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique publish attempt identifier (UUID)',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Associated post identifier (UUID)',
  })
  postId: string;

  @ApiProperty({
    enum: PublishAttemptStatus,
    example: PublishAttemptStatus.SUCCESS,
    description: 'Publish execution status (PENDING, SUCCESS, FAILED)',
  })
  status: PublishAttemptStatus;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Sanitized error message if publishing failed',
  })
  errorMessage: string | null;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Safe platform error code if applicable',
  })
  apiErrorCode: string | null;

  @ApiProperty({
    example: '2026-08-17T00:00:00.000Z',
    description: 'Publish execution start timestamp',
  })
  startedAt: Date;

  @ApiProperty({
    example: '2026-08-17T00:00:02.000Z',
    nullable: true,
    description: 'Publish execution completion timestamp',
  })
  finishedAt: Date | null;
}
