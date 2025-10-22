// src/auth/dto/oauth-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class OAuthProfileDto {
  @ApiProperty({
    description: 'OAuth provider name (e.g., google, github)',
    example: 'google',
  })
  @IsString()
  provider: string;

  @ApiProperty({
    description: 'Unique user ID from the OAuth provider',
    example: '108318052268079221395',
  })
  @IsString()
  providerId: string;

  @ApiPropertyOptional({
    description:
      'Username or handle (GitHub uses this; Google may not have one)',
    example: 'mohamed-sameh-albaz',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'User’s display name or full name',
    example: 'Mohamed Albaz',
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    description: 'Email address of the user (if available)',
    example: 'mohamedalbaz492@gmail.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'URL of the user’s profile image',
    example: 'https://avatars.githubusercontent.com/u/136837275?v=4',
  })
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Direct link to the user’s public profile page',
    example: 'https://github.com/mohamed-sameh-albaz',
  })
  @IsOptional()
  @IsUrl()
  profileUrl?: string;
}
