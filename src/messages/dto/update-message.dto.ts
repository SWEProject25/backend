import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LargeNumberLike } from 'crypto';

export class UpdateMessageDto {
  @ApiProperty({
    description: 'The ID of the message to update',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The sender ID',
    example: 3,
  })
  senderId: number;

  @ApiProperty({
    description: 'The updated message text',
    example: 'Updated message text',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}
