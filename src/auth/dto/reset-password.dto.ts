import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '1' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

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
  @Matches(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    },
  )
  newPassword: string;

  @ApiProperty({
    example: 'mohamedalbaz@gmail.com',
    description: 'The email of the user resetting the password',
  })
  @IsString()
  @IsNotEmpty()
  email: string;
}
