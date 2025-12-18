import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ToLowerCase } from 'src/common/decorators/lowercase.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { RequestType } from 'src/utils/constants';

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'mohamdalbaz@gmail.com',
    description: 'The email address of the user requesting password reset',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  @Trim()
  @ToLowerCase()
  email: string;

  @ApiProperty({
    enum: RequestType,
    default: RequestType.WEB,
    description: 'Device type (e.g. web or mobile) to determine redirect URL, default is web',
  })
  @IsEnum(RequestType)
  @IsOptional()
  type?: RequestType = RequestType.WEB;
}
