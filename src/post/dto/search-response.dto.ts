import { ApiProperty } from '@nestjs/swagger';
import { FeedPostDto, MediaDto, OriginalPostDataDto } from './timeline-feed-reponse.dto';

export class SearchPostDto {
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
}

export class SearchPostsDataDto {
  @ApiProperty({
    type: [SearchPostDto],
    description: 'Array of posts matching search criteria',
  })
  posts: SearchPostDto[];
}

export class SearchPostsResponseDto {
  @ApiProperty({ example: 'success', description: 'Response status' })
  status: string;

  @ApiProperty({
    example: 'Search results retrieved successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    type: SearchPostsDataDto,
    description: 'Search results data',
  })
  data: SearchPostsDataDto;

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      totalItems: 100,
      page: 1,
      limit: 10,
      totalPages: 10,
    },
  })
  metadata: {
    totalItems: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
