import { ApiProperty } from '@nestjs/swagger';
import { PostType, PostVisibility } from 'generated/prisma';

export class PostResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the post',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The ID of the user who created the post',
    example: 123,
  })
  userId: number;

  @ApiProperty({
    description: 'The textual content of the post',
    example: 'Excited to share my new project today!',
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
    example: 42,
    nullable: true,
  })
  parentId: number | null;

  @ApiProperty({
    description: 'The visibility level of the post',
    enum: PostVisibility,
    example: PostVisibility.EVERY_ONE,
  })
  visibility: PostVisibility;

  @ApiProperty({
    description: 'The date and time when the post was created',
    example: '2023-10-22T10:30:00.000Z',
  })
  createdAt: Date;
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
