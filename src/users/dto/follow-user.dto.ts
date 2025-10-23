import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class FollowUserDto {
  @IsInt()
  @IsNotEmpty({ message: 'User ID to follow is required' })
  @ApiProperty({
    description: 'The ID of the user to follow',
    example: 123,
  })
  followingId: number;
}
