import { ApiProperty } from '@nestjs/swagger';

export class UserInteractionDto {
  @ApiProperty({
    description: 'User ID',
    example: 123,
  })
  id: number;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
    nullable: true,
  })
  displayName: string | null;

  @ApiProperty({
    description: 'User bio',
    example: 'Software developer',
    nullable: true,
  })
  bio: string | null;

  @ApiProperty({
    description: 'Profile image URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiProperty({
    description: 'Date when the follow relationship was created',
    example: '2025-10-23T10:30:00.000Z',
  })
  followedAt: Date;

  @ApiProperty({
    description: 'Indicates if the user is followed back',
    example: true,
  })
  is_followed_by_me: boolean;
}
