import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique user identifier (UUID)',
  })
  id: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Unique username',
  })
  username: string;

  @ApiProperty({
    example: '2026-08-15T12:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-15T12:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
