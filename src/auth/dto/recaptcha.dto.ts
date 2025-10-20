import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RecaptchaDto {
  @ApiProperty({
    description: 'The Google reCAPTCHA response token from the client.',
    example: '03AGdBq24_...-4bE',
  })
  @IsString()
  @IsNotEmpty({ message: 'The reCAPTCHA token is required.' })
  recaptcha: string;
}
