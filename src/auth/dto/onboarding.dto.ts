import { ApiProperty } from '@nestjs/swagger';

export class OnboardingStatusDto {
  @ApiProperty({
    example: false,
    description: 'Whether user has selected their interests',
  })
  hasCompletedInterests: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether user has followed suggested accounts',
  })
  hasCompletedFollowing: boolean;
}
