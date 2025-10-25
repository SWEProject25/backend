import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SearchProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Search query is required' })
  @MinLength(1, { message: 'Search query must be at least 1 character' })
  @ApiProperty({
    description: 'Search query to find users by username or name',
    example: 'john',
    minLength: 1,
  })
  query: string;
}
