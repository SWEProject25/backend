import { ApiProperty } from '@nestjs/swagger';

export class MuteResponseDto {
  @ApiProperty({
    description: 'The ID of the user who is muting',
    example: 456,
  })
  muterId: number;

  @ApiProperty({
    description: 'The ID of the user being muted',
    example: 123,
  })
  mutedId: number;

  @ApiProperty({
    description: 'The date and time when the mute was created',
    example: '2025-10-22T10:30:00.000Z',
  })
  createdAt: Date;
}
