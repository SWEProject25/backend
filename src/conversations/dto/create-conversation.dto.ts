import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    description: 'The ID of the first user',
    example: 1,
  })
  user1Id: number;

  @ApiProperty({
    description: 'The ID of the second user',
    example: 2,
  })
  user2Id: number;
}
