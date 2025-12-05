import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeOAuthCodeDto {
  @ApiProperty({
    description: 'One-time OAuth code received from the redirect',
    example: 'abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
