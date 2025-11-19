import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user-response.dto';
import { OnboardingStatusDto } from './onboarding.dto';

export class LoginResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Logged in successfully' })
  message: string;

  @ApiProperty({ type: UserResponse })
  data: { user: { UserResponse } };

  @ApiProperty({
    type: OnboardingStatusDto,
    description: 'Onboarding status and next steps for the user',
  })
  onboarding: OnboardingStatusDto;
}

export class UserProfileDto {
  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'https://example.com/profile.jpg', nullable: true })
  profileImageUrl: string | null;

  @ApiProperty({
    description: 'The user’s date of birth in ISO format.',
    example: '2004-01-01',
    type: Date,
    format: 'date',
  })
  birthDate: Date;
}

export class UserDataDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: 'USER' })
  role: string;

  @ApiProperty({ type: UserProfileDto, nullable: true })
  profile: UserProfileDto | null;
}
