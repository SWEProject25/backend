import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';
import { ToLowerCase } from 'src/common/decorators/lowercase.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';

export class CheckEmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @Trim()
  @ToLowerCase()
  @Matches(/^[\u0020-\u007E]+$/, {
    message: 'Email must contain only ASCII characters (no emojis or Unicode symbols)',
  })
  @ApiProperty({
    description:
      'Valid ASCII email address. Must not contain emojis or Unicode characters. Automatically trimmed and lowercased.',
    example: 'mohmaedalbaz@gmail.com',
    format: 'email',
  })
  email: string;
}
