import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(50, { message: 'Username must be at most 50 characters long' })
  @Matches(/^[a-zA-Z](?!.*[_.-]{2})[a-zA-Z0-9._-]+$/, {
    message:
      'Username must start with a letter and can only contain letters, numbers, dots, underscores, and hyphens — without consecutive dots, underscores, or hyphens.',
  })
  @ApiProperty({
    description: 'The new username for the user',
    example: 'new_username',
    minLength: 3,
    maxLength: 50,
  })
  username: string;
}
