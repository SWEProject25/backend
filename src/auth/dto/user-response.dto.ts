import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UserResponse {
  @ApiProperty({
    example: 'albazMo90',
    description: 'The unique username of the user',
  })
  username: string;

  @ApiPropertyOptional({
    example: 'mohamedalbaz@gmail.com',
    description: 'Email address of the user',
  })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'User',
    description: 'Role assigned to the user',
  })
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({
    example: 'Mohamed Albaz',
    description: 'Full name of the user',
  })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: '2004-01-01',
    description: 'Birth date of the user',
    type: String,
    format: 'date',
  })
  @IsOptional()
  birthDate?: Date;

  @ApiPropertyOptional({
    example: null,
    description: 'Profile image URL of the user',
  })
  @IsOptional()
  profileImageUrl?: string | null;

  @ApiPropertyOptional({
    example: null,
    description: 'Banner image URL of the user',
  })
  @IsOptional()
  bannerImageUrl?: string | null;

  @ApiPropertyOptional({
    example: 'bio',
    description: 'Short bio or description of the user',
  })
  @IsOptional()
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'Egypt',
    description: 'User location',
  })
  @IsOptional()
  location?: string | null;

  @ApiPropertyOptional({
    example: null,
    description: 'User’s personal website URL',
  })
  @IsOptional()
  website?: string | null;

  @ApiProperty({
    example: '2025-10-15T21:10:02.000Z',
    description: 'Account creation date',
  })
  createdAt: Date;
}
