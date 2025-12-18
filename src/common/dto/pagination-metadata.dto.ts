import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetadataDto {
  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;
}
