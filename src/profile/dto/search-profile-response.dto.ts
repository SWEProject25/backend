import { ApiProperty } from '@nestjs/swagger';
import { ProfileResponseDto } from './profile-response.dto';

class PaginationMetadata {
  @ApiProperty({
    description: 'Total number of results',
    example: 25,
  })
  total: number;

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
    example: 3,
  })
  totalPages: number;
}

export class SearchProfileResponseDto {
  @ApiProperty({
    description: 'Response status',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Profiles found successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of matching profiles',
    type: [ProfileResponseDto],
  })
  data: ProfileResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetadata,
  })
  metadata: PaginationMetadata;
}
