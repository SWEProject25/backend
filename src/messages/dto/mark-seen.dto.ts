import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkSeenDto {
  @ApiProperty({
    description: 'The ID of the conversation',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  conversationId: number;

  @ApiProperty({
    description: 'The ID of the user marking messages as seen',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  userId: number;
}
