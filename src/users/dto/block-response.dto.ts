import { ApiProperty } from '@nestjs/swagger';

export class BlockResponseDto {
  @ApiProperty({
    description: 'The ID of the user who is blocking',
    example: 456,
  })
  blockerId: number;

  @ApiProperty({
    description: 'The ID of the user being blocked',
    example: 123,
  })
  blockedId: number;

  @ApiProperty({
    description: 'The date and time when the block was created',
    example: '2025-10-22T10:30:00.000Z',
  })
  createdAt: Date;
}
