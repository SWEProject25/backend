import { ApiProperty } from '@nestjs/swagger';

export class RepostUserDto {
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

  @ApiProperty({
    description: 'Whether the user is verified',
    example: true,
  })
  is_verified: boolean;
}

export class ToggleRepostResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Post reposted',
  })
  message: string;

  @ApiProperty({
    description: 'The toggle repost result',
    example: {
      message: 'Post reposted'
    },
  })
  data: {
    message: string;
  };
}

export class GetRepostersResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Reposters retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of users who reposted the post',
    type: [RepostUserDto],
  })
  data: RepostUserDto[];
}
