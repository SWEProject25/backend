import { ApiProperty } from '@nestjs/swagger';

class PostCountsDto {
  @ApiProperty({
    description: 'Number of likes on the post',
    example: 150,
  })
  likesCount: number;

  @ApiProperty({
    description: 'Number of reposts of the post',
    example: 75,
  })
  retweetsCount: number;

  @ApiProperty({
    description: 'Number of replies to the post',
    example: 30,
  })
  commentsCount: number;
}

export class GetPostStatsResponseDto {
  @ApiProperty({
    description: 'Status of the response',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Post stats retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The post stats data',
    type: PostCountsDto,
  })
  data: PostCountsDto;
}
