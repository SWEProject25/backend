import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessor } from './email.processor';
import { EmailService } from '../email.service';
import { Services } from 'src/utils/constants';
import { Job } from 'bullmq';
import { EmailJob } from '../interfaces/email-job.interface';
import { Logger } from '@nestjs/common';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let emailService: jest.Mocked<EmailService>;

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: Services.EMAIL,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    emailService = module.get(Services.EMAIL);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('instantiation', () => {
    it('should be defined', () => {
      expect(processor).toBeDefined();
    });

    it('should have a logger', () => {
      expect((processor as any).logger).toBeDefined();
    });

    it('should extend WorkerHost', () => {
      expect(processor).toHaveProperty('process');
    });

    it('should have emailService injected', () => {
      expect((processor as any).emailService).toBeDefined();
      expect((processor as any).emailService).toBe(emailService);
    });
  });

  describe('process', () => {
    const createMockJob = (data: EmailJob): Partial<Job<EmailJob>> => ({
      id: 'job-123',
      name: 'sendEmail',
      data,
      attemptsMade: 0,
      opts: { attempts: 3 } as any,
    });

    describe('successful email sending', () => {
      it('should process a job with string recipients successfully', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Test Subject',
          html: '<p>Test email</p>',
          text: 'Test email',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'msg-456',
        });

        const result = await processor.process(mockJob);

        expect(emailService.sendEmail).toHaveBeenCalledWith({
          recipients: jobData.recipients,
          subject: jobData.subject,
          html: jobData.html,
          text: jobData.text,
        });

        expect(result).toMatchObject({
          success: true,
          messageId: 'msg-456',
        });
        expect(result.timestamp).toBeDefined();
      });

      it('should process a job with object recipients successfully', async () => {
        const jobData: EmailJob = {
          recipients: [{ email: 'test@example.com', name: 'Test User' }],
          subject: 'Test Subject',
          html: '<p>Test email</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'msg-789',
        });

        const result = await processor.process(mockJob);

        expect(emailService.sendEmail).toHaveBeenCalledWith({
          recipients: jobData.recipients,
          subject: jobData.subject,
          html: jobData.html,
          text: undefined,
        });

        expect(result).toMatchObject({
          success: true,
          messageId: 'msg-789',
        });
      });

      it('should process a job with multiple recipients', async () => {
        const jobData: EmailJob = {
          recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
          subject: 'Bulk Email',
          html: '<p>Bulk email content</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'bulk-msg-001',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      });

      it('should process a job without optional text field', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'No Text Field',
          html: '<p>Only HTML</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'html-only-msg',
        });

        const result = await processor.process(mockJob);

        expect(emailService.sendEmail).toHaveBeenCalledWith({
          recipients: jobData.recipients,
          subject: jobData.subject,
          html: jobData.html,
          text: undefined,
        });
        expect(result.success).toBe(true);
      });

      it('should log processing start with job details', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;
        mockJob.attemptsMade = 2;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'test-msg',
        });

        await processor.process(mockJob);

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('Processing email job'),
        );
        expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('attempt 3/3'));
      });

      it('should log email sending details', async () => {
        const jobData: EmailJob = {
          recipients: ['test1@example.com', 'test2@example.com'],
          subject: 'Multiple Recipients',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'multi-msg',
        });

        await processor.process(mockJob);

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('Sending email to 2 recipient(s)'),
        );
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('Multiple Recipients'),
        );
      });

      it('should log successful completion with message ID', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Success Test',
          html: '<p>Success</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'success-msg-123',
        });

        await processor.process(mockJob);

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('completed successfully'),
        );
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('success-msg-123'),
        );
      });
    });

    describe('validation and error handling', () => {
      it('should return error when recipients array is empty', async () => {
        const jobData: EmailJob = {
          recipients: [],
          subject: 'No Recipients',
          html: '<p>Should not be sent</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        const result = await processor.process(mockJob);

        expect(result).toEqual({
          success: false,
          error: 'No recipients provided',
        });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.stringContaining('No recipients provided'),
        );
      });

      it('should return error when recipients is null', async () => {
        const jobData: EmailJob = {
          recipients: null as any,
          subject: 'Null Recipients',
          html: '<p>Should not be sent</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        const result = await processor.process(mockJob);

        expect(result).toEqual({
          success: false,
          error: 'No recipients provided',
        });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
      });

      it('should return error when recipients is undefined', async () => {
        const jobData: EmailJob = {
          recipients: undefined as any,
          subject: 'Undefined Recipients',
          html: '<p>Should not be sent</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        const result = await processor.process(mockJob);

        expect(result).toEqual({
          success: false,
          error: 'No recipients provided',
        });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
      });

      it('should throw error when email service returns null success', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Failure Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: false,
        });

        await expect(processor.process(mockJob)).rejects.toThrow('Email sending failed');
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          expect.stringContaining('Email sending returned no success result'),
        );
      });

      it('should throw error when email service returns null', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Null Result Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue(null);

        await expect(processor.process(mockJob)).rejects.toThrow('Email sending failed');
      });

      it('should throw error when email service returns undefined', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Undefined Result Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue(undefined as any);

        await expect(processor.process(mockJob)).rejects.toThrow('Email sending failed');
      });

      it('should throw error and log when email service throws', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Exception Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;
        const error = new Error('Email service failure');

        emailService.sendEmail.mockRejectedValue(error);

        await expect(processor.process(mockJob)).rejects.toThrow('Email service failure');
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          expect.stringContaining('Error processing job'),
          error,
        );
      });

      it('should rethrow the original error', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Rethrow Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;
        const originalError = new Error('Original error message');

        emailService.sendEmail.mockRejectedValue(originalError);

        await expect(processor.process(mockJob)).rejects.toBe(originalError);
      });
    });

    describe('job metadata handling', () => {
      it('should handle job with high attempt count', async () => {
        const jobData: EmailJob = {
          recipients: ['retry@example.com'],
          subject: 'Retry Test',
          html: '<p>Retry</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;
        mockJob.attemptsMade = 2;
        mockJob.opts.attempts = 5;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'retry-msg',
        });

        await processor.process(mockJob);

        expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('attempt 3/5'));
      });

      it('should process job with different job name', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Different Name',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;
        mockJob.name = 'customEmailJob';

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'custom-msg',
        });

        await processor.process(mockJob);

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('customEmailJob'),
        );
      });

      it('should process job with different job ID', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Custom ID',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;
        mockJob.id = 'custom-job-id-999';

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'custom-id-msg',
        });

        await processor.process(mockJob);

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          expect.stringContaining('custom-job-id-999'),
        );
      });
    });

    describe('edge cases', () => {
      it('should handle very long subject line', async () => {
        const longSubject = 'A'.repeat(1000);
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: longSubject,
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'long-subject-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
        expect(emailService.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({ subject: longSubject }),
        );
      });

      it('should handle very long HTML content', async () => {
        const longHtml = '<p>' + 'Lorem ipsum '.repeat(10000) + '</p>';
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Long HTML',
          html: longHtml,
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'long-html-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
        expect(emailService.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({ html: longHtml }),
        );
      });

      it('should handle special characters in email addresses', async () => {
        const jobData: EmailJob = {
          recipients: ['test+tag@example.co.uk', 'user.name@sub-domain.example.com'],
          subject: 'Special Chars',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'special-chars-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
      });

      it('should handle HTML with special characters', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Special HTML',
          html: '<p>&lt;script&gt;alert("test")&lt;/script&gt; &amp; special chars: © ® ™</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'special-html-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
      });

      it('should handle empty string HTML', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Empty HTML',
          html: '',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'empty-html-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
      });

      it('should handle empty string subject', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: '',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'empty-subject-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
      });

      it('should handle messageId being undefined in success response', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'No Message ID',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: undefined,
        });

        const result = await processor.process(mockJob);

        expect(result.success).toBe(true);
        expect(result.messageId).toBeUndefined();
      });
    });

    describe('timestamp generation', () => {
      it('should generate valid ISO timestamp', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Timestamp Test',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'timestamp-msg',
        });

        const result = await processor.process(mockJob);

        expect(result.timestamp).toBeDefined();
        expect(typeof result.timestamp).toBe('string');
        expect(() => new Date(result.timestamp)).not.toThrow();
      });

      it('should generate unique timestamps for different calls', async () => {
        const jobData: EmailJob = {
          recipients: ['test@example.com'],
          subject: 'Unique Timestamp',
          html: '<p>Test</p>',
        };

        const mockJob = createMockJob(jobData) as Job<EmailJob>;

        emailService.sendEmail.mockResolvedValue({
          success: true,
          messageId: 'unique-ts-msg',
        });

        const result1 = await processor.process(mockJob);
        await new Promise((resolve) => setTimeout(resolve, 10));
        const result2 = await processor.process(mockJob);

        expect(result1.timestamp).not.toBe(result2.timestamp);
      });
    });
  });
});
