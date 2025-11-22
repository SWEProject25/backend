import { ApiProperty } from '@nestjs/swagger';

class HashtagMetadata {
  @ApiProperty({ description: 'The hashtag that was searched', example: 'typescript' })
  hashtag: string;

  @ApiProperty({ description: 'Total number of posts with this hashtag', example: 42 })
  totalItems: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of posts per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}

export class SearchByHashtagResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Posts with hashtag #typescript retrieved successfully' })
  message: string;

  @ApiProperty({ type: [Object], description: 'Array of posts with the specified hashtag' })
  data: any[];

  @ApiProperty({ type: HashtagMetadata })
  metadata: HashtagMetadata;
}
