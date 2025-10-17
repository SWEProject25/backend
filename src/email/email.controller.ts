import { Controller, Inject, Post } from '@nestjs/common';
import { EmailService } from './email.service';
import { join } from 'path';
import { readFileSync } from 'fs';
import { Routes, Services } from 'src/utils/constants';

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
    // console.log(template);
    return this.emailService.sendEmail({
      subject: 'Account Verification',
      recipients: ['mohamedalbaz77@gmail.com'],
      html: template,
    });
  }
}
