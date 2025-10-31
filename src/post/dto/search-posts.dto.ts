import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PostType } from 'generated/prisma';

export class SearchPostsDto extends PaginationDto {
  @ApiProperty({
    description: 'Search query to match against post content (supports partial matching)',
    example: 'machine learning',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty({ message: 'Search query is required' })
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  searchQuery: string;

  @ApiPropertyOptional({ description: 'Filter search results by user ID', example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'Filter search results by type', example: 'POST' })
  @IsOptional()
  @IsEnum(PostType, {
    message: `Type must be one of: ${Object.values(PostType).join(', ')}`,
  })
  type?: PostType;

  @ApiPropertyOptional({
    description: 'Minimum similarity threshold (0.0 to 1.0)',
    example: 0.1,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  similarityThreshold?: number = 0.1;
}
