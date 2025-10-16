import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Logged in successfully' })
  message: string;

  @ApiProperty({ type: UserResponse })
  data: { user: { UserResponse } };
}
