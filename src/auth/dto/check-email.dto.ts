import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class CheckEmailDto {
  @ApiProperty({
    example: 'mohamedalbaz@gmail.com',
    description: 'The email address to check for existence',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
