import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { RequestType } from 'src/utils/constants';

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'mohamdalbaz@gmail.com',
    description: 'The email address of the user requesting password reset',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: RequestType,
    default: RequestType.WEB,
    description:
      'Device type (e.g. web or mobile) to determine redirect URL, default is web',
  })
  @IsEnum(RequestType)
  @IsOptional()
  type?: RequestType = RequestType.WEB;
}
