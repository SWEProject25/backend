import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class InterestDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Technology' })
  name: string;

  @ApiProperty({ example: 'technology' })
  slug: string;

  @ApiPropertyOptional({ example: 'Stay updated with the latest tech trends' })
  description: string | null;

  @ApiPropertyOptional({ example: '💻' })
  icon: string | null;
}

export class GetInterestsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Successfully retrieved interests' })
  message: string;

  @ApiProperty({ type: [InterestDto] })
  data: InterestDto[];

  @ApiProperty({ example: 12 })
  total: number;
}

export class SaveUserInterestsDto {
  @ApiProperty({
    example: [1, 2, 3, 5, 8],
    description: 'Array of interest IDs (minimum 1 interest required)',
    type: [Number],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one interest must be selected' })
  @IsInt({ each: true })
  @Type(() => Number)
  interestIds: number[];
}

export class UserInterestDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Technology' })
  name: string;

  @ApiProperty({ example: 'technology' })
  slug: string;

  @ApiPropertyOptional({ example: '💻' })
  icon: string | null;

  @ApiProperty({ example: '2025-11-18T09:17:32.000Z' })
  selectedAt: Date;
}

export class GetUserInterestsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Successfully retrieved user interests' })
  message: string;

  @ApiProperty({ type: [UserInterestDto] })
  data: UserInterestDto[];

  @ApiProperty({ example: 5 })
  total: number;
}

export class SaveUserInterestsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({
    example: 'Interests saved successfully. Please follow some users to complete onboarding.',
  })
  message: string;

  @ApiProperty({ example: 5 })
  savedCount: number;
}

export class GetAllInterestsResponseDto {
  @ApiProperty({
    example: 'success',
    description: 'Response status',
  })
  status: string;

  @ApiProperty({
    example: 'Successfully retrieved interests',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    example: 16,
    description: 'Total number of interests returned',
  })
  total: number;

  @ApiProperty({
    type: [InterestDto],
    description: 'Array of interest objects',
  })
  data: InterestDto[];
}
