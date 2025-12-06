import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PostType } from '@prisma/client';

export enum HashtagSearchOrderBy {
  MOST_LIKED = 'most_liked',
  LATEST = 'latest',
}

export class SearchByHashtagDto extends PaginationDto {
  @ApiProperty({
    description: 'Hashtag to search for (with or without # symbol)',
    example: 'typescript',
  })
  @IsString()
  hashtag: string;

  @ApiPropertyOptional({
    description: 'Filter posts by type',
    enum: PostType,
    example: 'POST',
  })
  @IsOptional()
  @IsEnum(PostType, {
    message: `Type must be one of: ${Object.values(PostType).join(', ')}`,
  })
  type?: PostType;

  @ApiPropertyOptional({
    description: 'Filter posts by user ID',
    example: 42,
  })
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({
    description: 'Filter posts created before this date (ISO 8601 format)',
    example: '2024-12-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  before_date?: string;

  @ApiPropertyOptional({
    description: 'Order search results by most liked or latest',
    enum: HashtagSearchOrderBy,
    example: HashtagSearchOrderBy.MOST_LIKED,
  })
  @IsOptional()
  @IsEnum(HashtagSearchOrderBy, {
    message: `order_by must be one of: ${Object.values(HashtagSearchOrderBy).join(', ')}`,
  })
  order_by?: HashtagSearchOrderBy = HashtagSearchOrderBy.MOST_LIKED;
}
