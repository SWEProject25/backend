import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class VerifyResetTokenDto {
  @ApiProperty({ example: '1' })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ example: 'reset-token-from-email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
