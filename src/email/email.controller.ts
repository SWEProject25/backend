import { Body, Controller, Inject, Post } from '@nestjs/common';
import { EmailService } from './email.service';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { Routes, Services } from 'src/utils/constants';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller(Routes.EMAIL)
export class EmailController {
  constructor(
    @Inject(Services.EMAIL)
    private readonly emailService: EmailService,
  ) {}
  @Post()
  public sendEmail() {
    const templatePath = join(
      process.cwd(), // points to the project root
      'src',
      'email',
      'templates',
      'email-verification.html',
    );
    const template = readFileSync(templatePath, 'utf-8');
    return this.emailService.sendEmail({
      subject: 'Account Verification',
      recipients: ['mohamedalbaz77@gmail.com'],
      html: template,
    });
  }

  @Post('test')
  @Public()
  async testEmail(@Body('email') email: string) {
    const result = await this.emailService.sendEmail({
      recipients: [email],
      subject: 'Test Email from Azure',
      html: '<h1>Test Email</h1><p>If you received this, Azure email is working!</p>',
      text: 'Test Email - If you received this, Azure email is working!',
    });

    return result;
  }
}
