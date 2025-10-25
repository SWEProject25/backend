import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyResetTokenDto {
  @ApiProperty({ example: '1' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'reset-token-from-email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
