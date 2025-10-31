import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PostType } from 'generated/prisma';

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
}
