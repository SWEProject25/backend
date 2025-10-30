import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ToLowerCase } from 'src/common/decorators/lowercase.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';

export class UpdateEmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @Trim()
  @ToLowerCase()
  @ApiProperty({
    description: 'The new email address for the user',
    example: 'newemail@example.com',
    format: 'email',
  })
  email: string;
}
