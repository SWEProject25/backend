import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetNotificationsDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by read status',
    example: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiProperty({
    description:
      'Comma-separated notification types to include (e.g., "DM,MENTION"). If specified, only these types will be returned.',
    example: 'DM,MENTION',
    required: false,
  })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiProperty({
    description:
      'Comma-separated notification types to exclude (e.g., "DM,MENTION"). If specified, these types will be excluded from results.',
    example: 'DM,MENTION',
    required: false,
  })
  @IsOptional()
  @IsString()
  exclude?: string;
}
