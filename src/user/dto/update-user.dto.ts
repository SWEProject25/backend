import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNotEmpty, IsEmail } from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Invalid email format' })
  @ApiPropertyOptional({
    description: 'email address of the user',
    example: 'mohamedalbaz@gmail.com',
  })
  email: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Indicates whether the user email is verified',
    example: true,
  })
  is_verified?: boolean;
}
