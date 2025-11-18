import { ApiProperty } from '@nestjs/swagger';
import { ProfileResponseDto } from './profile-response.dto';

export class ProfileWithFollowStatusDto extends ProfileResponseDto {
  @ApiProperty({
    description: 'Whether the current user is following this profile',
    example: true,
  })
  is_followed_by_me: boolean;
}
