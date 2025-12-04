import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '../enums/notification.enum';

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'FCM device token',
    example: 'fcm_token_example_123456789',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Platform type',
    enum: Platform,
    example: Platform.WEB,
  })
  @IsEnum(Platform)
  @IsNotEmpty()
  platform: Platform;
}
