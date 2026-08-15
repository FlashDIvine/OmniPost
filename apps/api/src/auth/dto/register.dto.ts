import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Unique username (3-30 chars, alphanumeric, underscore, dot)',
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_.]+$/, {
    message:
      'Username can only contain alphanumeric characters, underscores, and dots',
  })
  username: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'User password (minimum 6 characters)',
    minLength: 6,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters' })
  password: string;
}
