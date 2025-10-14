import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UserResponse {
  @ApiProperty({ example: 8 })
  id: number;

  @ApiProperty({ example: 'Mohamed Albaz' })
  name: string;

  @ApiPropertyOptional({ example: 'mohamedalbaz@gmail.com' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Admin' })
  @IsOptional()
  role?: string;
}
