import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsUrl, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Name must be at most 30 characters long' })
  @ApiPropertyOptional({
    description: 'The name of the user',
    example: 'John Doe',
    maxLength: 30,
  })
  name?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @ApiPropertyOptional({
    description: 'The birth date of the user',
    example: '1990-01-01',
    type: String,
    format: 'date',
  })
  birthDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Bio must be at most 160 characters long' })
  @ApiPropertyOptional({
    description: 'User biography',
    example: 'Software developer passionate about clean code',
    maxLength: 160,
  })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Location must be at most 100 characters long' })
  @ApiPropertyOptional({
    description: 'User location',
    example: 'San Francisco, CA',
    maxLength: 100,
  })
  location?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid website URL format' })
  @MaxLength(100, { message: 'Website must be at most 100 characters long' })
  @ApiPropertyOptional({
    description: 'User website URL',
    example: 'https://johndoe.com',
    maxLength: 100,
  })
  website?: string;
}
