import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    type: () => UserResponseDto,
    description: 'User profile details',
  })
  user: UserResponseDto;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived JWT access token',
  })
  accessToken: string;
}

export class RefreshResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'New short-lived JWT access token',
  })
  accessToken: string;
}

export class MessageResponseDto {
  @ApiProperty({
    example: 'Logged out successfully',
    description: 'Status message',
  })
  message: string;
}
