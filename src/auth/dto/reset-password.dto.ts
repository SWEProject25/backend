import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Matches, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

export class ResetPasswordDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    example: 'b1f5e58d9a3c43c2aefdcf57b1d8ad72',
    description: 'The token sent to the user for password reset',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecurePassword123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Trim()
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,50}$/, {
    message:
      'Password must be 8–50 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character. Emojis and non-ASCII characters are not allowed.',
  })
  newPassword: string;

  @ApiProperty({
    example: 'mohamedalbaz@gmail.com',
    description: 'The email of the user resetting the password',
  })
  @IsString()
  @IsNotEmpty()
  email: string;
}
