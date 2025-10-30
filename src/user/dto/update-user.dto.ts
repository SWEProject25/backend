import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEmail,
  IsDate,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Trim } from 'src/common/decorators/trim.decorator';
import { ToLowerCase } from 'src/common/decorators/lowercase.decorator';
import { IsAdult } from 'src/common/decorators/is-adult.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @Trim()
  @ToLowerCase()
  @Matches(/^[\u0020-\u007E]+$/, {
    message: 'Email must contain only ASCII characters (no emojis or Unicode symbols)',
  })
  @ApiPropertyOptional({
    description:
      'Valid ASCII email address. Must not contain emojis or Unicode characters. Automatically trimmed and lowercased.',
    example: 'newemail@example.com',
    format: 'email',
  })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(50, { message: 'Username must be at most 50 characters long' })
  @Matches(/^[a-zA-Z](?!.*[_.]{2})[a-zA-Z0-9._]*[a-zA-Z0-9]$/, {
    message:
      'Username must start with a letter, end with a letter or number, and can only contain letters, numbers, dots, and underscores — without consecutive dots or underscores.',
  })
  @Trim()
  @ToLowerCase()
  @ApiPropertyOptional({
    description:
      'The new username for the user. Must start with a letter, contain only letters, numbers, dots, and underscores, and must not include consecutive dots or underscores. Automatically trimmed and lowercased.',
    example: 'mohamed_albaz',
    minLength: 3,
    maxLength: 50,
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  @MaxLength(50, { message: 'Name must be at most 50 characters long' })
  @Matches(/^[\p{L}\p{M}' -]+$/u, {
    message:
      'Name should match an entire string that contains only letters (from any language), accent marks, spaces, hyphens, or apostrophes, and reject anything else — including emojis, numbers, or punctuation.',
  })
  @Trim()
  @ApiPropertyOptional({
    description:
      'Full name of the user. Only letters, accents, spaces, hyphens, or apostrophes are allowed. Numbers and emojis are rejected.',
    example: 'Mohamed Albaz',
    minLength: 3,
    maxLength: 50,
  })
  name?: string;

  @IsOptional()
  @Type(() => Date)
  @IsAdult({ message: 'User must be between 15 and 100 years old' })
  @IsDate({ message: 'Invalid birth date format. Expected YYYY-MM-DD.' })
  @ApiPropertyOptional({
    description: 'The user’s date of birth in ISO format.',
    example: '2004-01-01',
    type: Date,
    format: 'date',
  })
  birthDate?: Date;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid profile image URL format' })
  @ApiPropertyOptional({
    description: 'URL to the user’s profile image. Must be a valid HTTPS/HTTP URL.',
    example: 'https://example.com/images/profile.jpg',
    format: 'uri',
  })
  profileImageUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid banner image URL format' })
  @ApiPropertyOptional({
    description: 'URL to the user’s banner image. Must be a valid HTTPS/HTTP URL.',
    example: 'https://example.com/images/banner.jpg',
    format: 'uri',
  })
  bannerImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Bio must be at most 160 characters long' })
  @Trim()
  @ApiPropertyOptional({
    description: 'A short bio or description for the user profile. Maximum of 160 characters.',
    example: 'Web developer | Coffee lover ☕ | Building cool stuff with JS!',
    maxLength: 160,
  })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Location must be at most 100 characters long' })
  @Trim()
  @ApiPropertyOptional({
    description: 'User location (e.g., city, country, or region). Maximum of 100 characters.',
    example: 'Cairo, Egypt',
    maxLength: 100,
  })
  location?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid website URL format' })
  @ApiPropertyOptional({
    description:
      'Link to the user’s personal or professional website. Must be a valid HTTPS/HTTP URL.',
    example: 'https://mohamedalbaz.dev',
    format: 'uri',
  })
  website?: string;
}
