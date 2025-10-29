import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class EmailDto {
  @ApiProperty({
    example: 'mohamedalbaz@gmail.com',
    description: "The user's email address to which the OTP will be sent.",
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;
}

export class VerifyOtpDto extends EmailDto {
  @ApiProperty({
    example: '458321',
    description: 'The 6-digit One-Time Password (OTP) sent to the user’s email.',
  })
  @IsNotEmpty({ message: 'otp is required' })
  @Length(6, 6, { message: 'otp must be exactly 6 digits long' })
  otp: string;
}
