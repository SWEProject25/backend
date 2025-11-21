import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '@prisma/client';

export class AuthorDto {
  @ApiProperty({ example: 1, description: 'User ID of the author' })
  userId: number;

  @ApiProperty({ example: 'johndoe', description: 'Username of the author' })
  username: string;

  @ApiProperty({ example: true, description: 'Whether the author is verified' })
  verified: boolean;

  @ApiProperty({ example: 'John Doe', description: 'Display name of the author' })
  name: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    description: 'Avatar URL',
    nullable: true,
  })
  avatar: string | null;
}

export class MediaDto {
  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'Media URL' })
  url: string;

  @ApiProperty({ enum: MediaType, description: 'Type of media' })
  type: MediaType;
}

export class OriginalPostDataDto {
  @ApiProperty({ example: 1, description: 'User ID of the original author' })
  userId: number;

  @ApiProperty({ example: 'johndoe', description: 'Username of the original author' })
  username: string;

  @ApiProperty({ example: true, description: 'Whether the original author is verified' })
  verified: boolean;

  @ApiProperty({ example: 'John Doe', description: 'Display name of the original author' })
  name: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    description: 'Avatar URL',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({ example: 123, description: 'Original post ID' })
  postId: number;

  @ApiProperty({ example: '2023-11-21T10:00:00Z', description: 'Post creation date' })
  date: Date;

  @ApiProperty({ example: 150, description: 'Number of likes' })
  likesCount: number;

  @ApiProperty({ example: 50, description: 'Number of reposts' })
  retweetsCount: number;

  @ApiProperty({ example: 25, description: 'Number of replies' })
  commentsCount: number;

  @ApiProperty({ example: true, description: 'Whether current user liked this post' })
  isLikedByMe: boolean;

  @ApiProperty({ example: false, description: 'Whether current user follows the author' })
  isFollowedByMe: boolean;

  @ApiProperty({ example: false, description: 'Whether current user reposted this post' })
  isRepostedByMe: boolean;

  @ApiProperty({ example: 'This is the original post content', description: 'Post content' })
  text: string;

  @ApiProperty({ type: [MediaDto], description: 'Media attachments' })
  media: MediaDto[];
}

export class FeedPostDto {
  @ApiProperty({ example: 1, description: 'User ID of the author' })
  userId: number;

  @ApiProperty({ example: 'johndoe', description: 'Username of the author' })
  username: string;

  @ApiProperty({ example: true, description: 'Whether the author is verified' })
  verified: boolean;

  @ApiProperty({ example: 'John Doe', description: 'Display name of the author' })
  name: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    description: 'Avatar URL',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({ example: 456, description: 'Post ID' })
  postId: number;

  @ApiProperty({ example: '2023-11-21T12:00:00Z', description: 'Post creation date' })
  date: Date;

  @ApiProperty({ example: 200, description: 'Number of likes' })
  likesCount: number;

  @ApiProperty({ example: 75, description: 'Number of reposts' })
  retweetsCount: number;

  @ApiProperty({ example: 30, description: 'Number of replies' })
  commentsCount: number;

  @ApiProperty({ example: true, description: 'Whether current user liked this post' })
  isLikedByMe: boolean;

  @ApiProperty({ example: false, description: 'Whether current user follows the author' })
  isFollowedByMe: boolean;

  @ApiProperty({ example: false, description: 'Whether current user reposted this post' })
  isRepostedByMe: boolean;

  @ApiProperty({ example: 'This is a post content', description: 'Post content' })
  text: string;

  @ApiProperty({ type: [MediaDto], description: 'Media attachments' })
  media: MediaDto[];

  @ApiProperty({ example: false, description: 'Whether this is a repost' })
  isRepost: boolean;

  @ApiProperty({ example: false, description: 'Whether this is a quote tweet' })
  isQuote: boolean;

  @ApiProperty({
    type: OriginalPostDataDto,
    description: 'Original post information (for quotes and reposts)',
    nullable: true,
    required: false,
  })
  originalPostData?: OriginalPostDataDto;

  @ApiProperty({ example: 25.5, description: 'Personalization score', required: false })
  personalizationScore?: number;

  @ApiProperty({ example: 0.85, description: 'Quality score from ML model', required: false })
  qualityScore?: number;

  @ApiProperty({ example: 20.125, description: 'Final combined score', required: false })
  finalScore?: number;
}

export class TimelineFeedDataDto {
  @ApiProperty({
    type: [FeedPostDto],
    description: 'Array of posts in the timeline feed',
  })
  posts: FeedPostDto[];
}

export class TimelineFeedResponseDto {
  @ApiProperty({ example: 'success', description: 'Response status' })
  status: string;

  @ApiProperty({ example: 'Posts retrieved successfully', description: 'Response message' })
  message: string;

  @ApiProperty({
    type: TimelineFeedDataDto,
    description: 'Timeline feed data',
  })
  data: TimelineFeedDataDto;
}
