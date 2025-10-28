import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PostType } from 'generated/prisma';

export class PostFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter posts by user ID', example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'Filter posts by hashtag', example: '#nestjs' })
  @IsOptional()
  @IsString()
  hashtag?: string;

  @ApiPropertyOptional({ description: 'Filter posts by visibility', example: 'REPLY' })
  @IsOptional()
  @IsEnum(PostType, {
    message: `Type must be one of: ${Object.values(PostType).join(', ')}`,
  })
  type?: PostType;
}
