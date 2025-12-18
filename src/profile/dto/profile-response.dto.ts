import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  username: string;

  @ApiProperty({
    description: 'User email',
    example: 'john@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User role',
    example: 'USER',
    enum: ['USER', 'ADMIN'],
  })
  role: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  created_at: Date;
}

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
  birthDate: Date;

  @ApiPropertyOptional({
    description: 'Profile image URL',
    example: 'https://example.com/profile.jpg',
  })
  profileImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Banner image URL',
    example: 'https://example.com/banner.jpg',
  })
  bannerImageUrl?: string;

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

  @ApiPropertyOptional({
    description: 'Whether the user has been blocked by the profile owner',
    example: false,
  })
  is_been_blocked?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the profile owner is blocked by the current user',
    example: false,
  })
  is_blocked_by_me?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the profile owner is muted by the current user',
    example: false,
  })
  is_muted_by_me?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the current user follows this profile',
    example: false,
  })
  is_followed_by_me?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this profile follows the current user',
    example: false,
  })
  is_following_me?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is verified',
    example: true,
  })
  verified?: boolean;

  @ApiProperty({
    description: 'Profile creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Profile last update timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Associated user information',
    type: UserInfoDto,
  })
  User: UserInfoDto;

  @ApiProperty({
    description: 'Number of followers',
    example: 100,
  })
  followersCount: number;

  @ApiProperty({
    description: 'Number of accounts following',
    example: 50,
  })
  followingCount: number;
}
