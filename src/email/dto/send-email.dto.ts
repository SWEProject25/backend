import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendEmailDto {
  @IsEmail({}, { each: true })
  @IsNotEmpty()
  recipients: string[] | Array<{ email: string; name?: string }>;

  @IsString()
  subject: string;

  @IsString()
  @IsNotEmpty()
  html: string;

  @IsOptional()
  @IsString()
  text?: string;
}
