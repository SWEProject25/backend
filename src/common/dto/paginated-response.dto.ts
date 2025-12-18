import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetadataDto } from './pagination-metadata.dto';

export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Response status',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Data retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of data items',
    isArray: true,
  })
  data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetadataDto,
  })
  metadata: PaginationMetadataDto;
}
