import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Username',
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
