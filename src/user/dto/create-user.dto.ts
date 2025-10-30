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
import { IsAdult } from 'src/common/decorators/is-adult.decorator';
import { ToLowerCase } from 'src/common/decorators/lowercase.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  @MaxLength(50, { message: 'Name must be at most 50 characters long' })
  @Trim()
  @Matches(/^[\p{L}\p{M}' -]+$/u, {
    message:
      'Name should match an entire string that contains only letters (from any language), accent marks, spaces, hyphens, or apostrophes, and reject anything else — including emojis, numbers, or punctuation.',
  })
  @ApiProperty({
    description: 'The name for the user',
    example: 'Mohaned Albaz',
    minLength: 3,
    maxLength: 50,
  })
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @Trim()
  @ToLowerCase()
  @Matches(/^[\u0020-\u007E]+$/, {
    message: 'Email must contain only ASCII characters (no emojis or Unicode symbols)',
  })
  @ApiProperty({
    description:
      'Valid ASCII email address. Must not contain emojis or Unicode characters. Automatically trimmed and lowercased.',
    example: 'mohmaedalbaz@gmail.com',
    format: 'email',
  })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must be at most 50 characters long' })
  @Trim()
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,50}$/, {
    message:
      'Password must be 8–50 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character. Emojis and non-ASCII characters are not allowed.',
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

  @IsDate({ message: 'Invalid birth date format. Expected YYYY-MM-DD.' })
  @Type(() => Date)
  @IsNotEmpty()
  @IsAdult({ message: 'User must be between 15 and 100 years old' })
  @ApiProperty({
    description: 'The user’s date of birth in ISO format.',
    example: '2004-01-01',
    type: Date,
    format: 'date',
  })
  birthDate: Date;
}
