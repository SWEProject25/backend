import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class UpdateEmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @ApiProperty({
    description: 'The new email address for the user',
    example: 'newemail@example.com',
    format: 'email',
  })
  email: string;
}
