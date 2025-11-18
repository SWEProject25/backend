import { ApiProperty } from '@nestjs/swagger';
import { ProfileWithFollowStatusDto } from './profile-with-follow-status-response.dto';

export class GetProfileWithFollowStatusResponseDto {
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
    type: ProfileWithFollowStatusDto,
  })
  data: ProfileWithFollowStatusDto;
}
