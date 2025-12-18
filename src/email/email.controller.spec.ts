import { Test, TestingModule } from '@nestjs/testing';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { Services } from 'src/utils/constants';
import * as fs from 'node:fs';

jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

describe('EmailController', () => {
  let controller: EmailController;
  let mockEmailService: any;

  beforeEach(async () => {
    mockEmailService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        {
          provide: Services.EMAIL,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<EmailController>(EmailController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should read template and send email', async () => {
      const templateContent = '<h1>Verification</h1>';
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);
      mockEmailService.sendEmail.mockResolvedValue({ success: true, messageId: '123' });

      const result = await controller.sendEmail();

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        subject: 'Account Verification',
        recipients: ['mohamedalbaz77@gmail.com'],
        html: templateContent,
      });
      expect(result).toEqual({ success: true, messageId: '123' });
    });

    it('should handle email service failure', async () => {
      const templateContent = '<h1>Verification</h1>';
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);
      mockEmailService.sendEmail.mockResolvedValue(null);

      const result = await controller.sendEmail();

      expect(result).toBeNull();
    });
  });

  describe('testEmail', () => {
    it('should send test email to provided address', async () => {
      mockEmailService.sendEmail.mockResolvedValue({ success: true, messageId: '456' });

      const result = await controller.testEmail('test@example.com');

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        recipients: ['test@example.com'],
        subject: 'Test Email from Azure',
        html: '<h1>Test Email</h1><p>If you received this, Azure email is working!</p>',
        text: 'Test Email - If you received this, Azure email is working!',
      });
      expect(result).toEqual({ success: true, messageId: '456' });
    });

    it('should handle test email failure', async () => {
      mockEmailService.sendEmail.mockResolvedValue(null);

      const result = await controller.testEmail('test@example.com');

      expect(result).toBeNull();
    });

    it('should send to different email addresses', async () => {
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      await controller.testEmail('another@example.com');

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: ['another@example.com'],
        }),
      );
    });
  });
});
