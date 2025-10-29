import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsDate,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  @MaxLength(30, { message: 'Name must be at most 30 characters long' })
  @ApiProperty({
    description: 'The name for the user',
    example: 'Mohaned Albaz',
    minLength: 3,
    maxLength: 30,
  })
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @ApiProperty({
    description: 'The email address of the user',
    example: 'mohmaedalbaz@gmail.com',
    format: 'email',
  })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must be at most 50 characters long' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message:
      'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  @ApiProperty({
    description:
      'The password for the user account (must include uppercase, lowercase, number, and special character)',
    example: 'Password123!',
    minLength: 8,
    maxLength: 50,
    format: 'password',
  })
  password: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  @ApiProperty({
    description: 'The birth date of the user',
    example: '2004-01-01',
    type: Date,
    format: 'date',
  })
  birthDate: Date;
}
