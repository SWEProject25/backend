import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description:
      'The new password for the user account (must include uppercase, lowercase, number, and special character)',
    example: 'NewPassword123!',
    minLength: 8,
    maxLength: 50,
    format: 'password',
  })
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50, { message: 'Password must be at most 50 characters long' })
  @Trim()
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,50}$/, {
    message:
      'Password must be 8–50 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character. Emojis and non-ASCII characters are not allowed.',
  })
  newPassword: string;
}
