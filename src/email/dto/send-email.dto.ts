import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendEmailDto {
  @IsEmail({}, { each: true })
  @IsNotEmpty()
  recipients: string[];

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  html: string;

  @IsOptional()
  @IsString()
  text?: string;
}
