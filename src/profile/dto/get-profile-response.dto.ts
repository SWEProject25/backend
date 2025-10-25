import { ApiProperty } from '@nestjs/swagger';
import { ProfileResponseDto } from './profile-response.dto';

export class GetProfileResponseDto {
  @ApiProperty({
    description: 'Response status',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Profile retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Profile data',
    type: ProfileResponseDto,
  })
  data: ProfileResponseDto;
}
