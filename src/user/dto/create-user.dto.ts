import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @ApiProperty({
    description: 'The name for the user',
    example: 'johndoe',
  })
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The email address of the user',
    example: 'user@example.com',
    format: 'email',
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The password for the user account',
    example: 'Password123!',
    format: 'password',
  })
  password: string;
}
