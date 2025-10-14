import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user-response.dto';

export class RegisterResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({
    example:
      'Account created successfully. Please check your email for verification',
  })
  message: string;

  @ApiProperty({ type: UserResponse })
  user: UserResponse;
}
