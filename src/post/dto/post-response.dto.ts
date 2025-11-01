import { ApiProperty } from '@nestjs/swagger';
import { PostType, PostVisibility, MediaType } from 'generated/prisma';

class PostCountsDto {
  @ApiProperty({
    description: 'Number of likes on the post',
    example: 1,
  })
  likes: number;

  @ApiProperty({
    description: 'Number of reposts',
    example: 1,
  })
  repostedBy: number;

  @ApiProperty({
    description: 'Number of replies',
    example: 0,
  })
  Replies: number;
}

class PostUserDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Username',
    example: 'mostafayo597',
  })
  username: string;
}

class PostMediaDto {
  @ApiProperty({
    description: 'Media URL',
    example: 'https://stsimpleappiee20o.blob.core.windows.net/media/d679f207-9248-49e7-917b-9cdc358217ed.png',
  })
  media_url: string;

  @ApiProperty({
    description: 'Media type',
    enum: MediaType,
    example: MediaType.IMAGE,
  })
  type: MediaType;
}

export class PostResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the post',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The ID of the user who created the post',
    example: 1,
  })
  user_id: number;

  @ApiProperty({
    description: 'The textual content of the post',
    example: 'hey',
  })
  content: string;

  @ApiProperty({
    description: 'The type of post',
    enum: PostType,
    example: PostType.POST,
  })
  type: PostType;

  @ApiProperty({
    description: 'The ID of the parent post (if this is a reply or quote)',
    example: null,
    nullable: true,
  })
  parent_id: number | null;

  @ApiProperty({
    description: 'The visibility level of the post',
    enum: PostVisibility,
    example: PostVisibility.EVERY_ONE,
  })
  visibility: PostVisibility;

  @ApiProperty({
    description: 'The date and time when the post was created',
    example: '2025-10-29T20:42:08.132Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Whether the post is deleted',
    example: false,
  })
  is_deleted: boolean;

  @ApiProperty({
    description: 'Post interaction counts',
    type: PostCountsDto,
  })
  _count: PostCountsDto;

  @ApiProperty({
    description: 'User who created the post',
    type: PostUserDto,
  })
  User: PostUserDto;

  @ApiProperty({
    description: 'Media attached to the post',
    type: [PostMediaDto],
  })
  media: PostMediaDto[];

  @ApiProperty({
    description: 'Whether the current user has liked this post',
    example: true,
  })
  isLikedByMe?: boolean;

  @ApiProperty({
    description: 'Whether the current user has reposted this post',
    example: true,
  })
  isRepostedByMe?: boolean;
}

export class CreatePostResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Post created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The created post data',
    type: PostResponseDto,
  })
  data: PostResponseDto;
}

export class GetPostResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Post retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The post data',
    type: PostResponseDto,
  })
  data: PostResponseDto;
}

export class GetPostsResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Posts retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of posts',
    type: [PostResponseDto],
  })
  data: PostResponseDto[];
}

export class DeletePostResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Post deleted successfully',
  })
  message: string;
}
