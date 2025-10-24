import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveMessageDto {
  @ApiProperty({
    description: 'The ID of the user removing the message',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    description: 'The ID of the conversation',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  conversationId: number;

  @ApiProperty({
    description: 'The ID of the message to remove',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  messageId: number;
}
