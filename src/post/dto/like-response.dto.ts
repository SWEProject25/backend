import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    description: 'The unique identifier of the user',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The username of the user',
    example: 'john_doe',
  })
  username: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'john@example.com',
  })
  email: string;
}

export class ToggleLikeResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Post liked',
  })
  message: string;

  @ApiProperty({
    description: 'The toggle like result',
    example: {
      liked: true,
      message: 'Post liked'
    },
  })
  data: {
    liked: boolean;
    message: string;
  };
}

export class GetLikersResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Likers retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of users who liked the post',
    type: [UserDto],
  })
  data: UserDto[];
}

export class GetLikedPostsResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Liked posts retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of posts liked by the user',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        user_id: { type: 'number', example: 123 },
        content: { type: 'string', example: 'This is a great post!' },
        type: { type: 'string', example: 'POST' },
        parent_id: { type: 'number', nullable: true, example: null },
        visibility: { type: 'string', example: 'EVERY_ONE' },
        created_at: { type: 'string', format: 'date-time', example: '2023-10-22T10:30:00.000Z' },
      },
    },
  })
  data: any[];
}
