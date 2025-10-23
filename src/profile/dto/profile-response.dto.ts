import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({
    description: 'Profile ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'User ID associated with this profile',
    example: 1,
  })
  user_id: number;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User birth date',
    example: '1990-01-01T00:00:00.000Z',
  })
  birth_date: Date;

  @ApiPropertyOptional({
    description: 'Profile image URL',
    example: 'https://example.com/profile.jpg',
  })
  profile_image_url?: string;

  @ApiPropertyOptional({
    description: 'Banner image URL',
    example: 'https://example.com/banner.jpg',
  })
  banner_image_url?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Software developer',
  })
  bio?: string;

  @ApiPropertyOptional({
    description: 'User location',
    example: 'San Francisco, CA',
  })
  location?: string;

  @ApiPropertyOptional({
    description: 'User website',
    example: 'https://johndoe.com',
  })
  website?: string;

  @ApiPropertyOptional({
    description: 'Whether the profile is deactivated',
    example: false,
  })
  is_deactivated?: boolean;

  @ApiProperty({
    description: 'Profile creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Profile last update timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  updated_at: Date;
}
