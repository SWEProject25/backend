import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user-response.dto';

class RegisterDataResponseDto {
  @ApiProperty({ type: UserResponse })
  user: UserResponse;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({
    example:
      'Account created successfully. Please check your email for verification',
  })
  message: string;

  @ApiProperty({ type: RegisterDataResponseDto })
  data: RegisterDataResponseDto;
}
