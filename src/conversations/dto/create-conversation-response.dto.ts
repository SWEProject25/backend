import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationResponseDto {
  @ApiProperty({
    description: 'The ID of the conversation',
    example: 1,
  })
  conversationId: number;

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

  @ApiProperty({
    description: 'The creation date of the conversation',
    example: new Date(),
  })
  createdAt: Date;
}
