import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'mohamedalbaz@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Test1234!',
    description: 'User password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
