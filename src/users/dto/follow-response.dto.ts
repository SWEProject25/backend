import { ApiProperty } from '@nestjs/swagger';

export class FollowResponseDto {
  @ApiProperty({
    description: 'The ID of the user who is following',
    example: 456,
  })
  followerId: number;

  @ApiProperty({
    description: 'The ID of the user being followed',
    example: 123,
  })
  followingId: number;

  @ApiProperty({
    description: 'The date and time when the follow was created',
    example: '2025-10-22T10:30:00.000Z',
  })
  createdAt: Date;
}
