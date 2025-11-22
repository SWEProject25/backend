import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSuggestedUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Number of users to retrieve',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Exclude users already followed (default: true for authenticated users)',
    example: true,
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  excludeFollowed?: boolean;

  @ApiPropertyOptional({
    description: 'Exclude blocked users (default: true for authenticated users)',
    example: true,
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  excludeBlocked?: boolean;
}

export class SuggestedUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({
    example: {
      name: 'John Doe',
      bio: 'Software Engineer | Tech Enthusiast',
      profileImageUrl: 'https://example.com/profile.jpg',
      bannerImageUrl: 'https://example.com/banner.jpg',
      location: 'San Francisco, CA',
      website: 'https://johndoe.com',
    },
  })
  profile: {
    name: string;
    bio: string | null;
    profileImageUrl: string | null;
    bannerImageUrl: string | null;
    website: string | null;
  } | null;

  @ApiProperty({ example: 15240 })
  followersCount: number;

  @ApiProperty({ example: false })
  isVerified: boolean;
}

export class SuggestedUsersResponseDto {
  @ApiProperty({ example: 'success', description: 'Response status' })
  status: string;

  @ApiProperty({ type: [SuggestedUserDto] })
  data: { users: SuggestedUserDto[] };

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 'Successfully retrieved suggested users' })
  message: string;
}
