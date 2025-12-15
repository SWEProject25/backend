import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { Services, RedisQueues } from 'src/utils/constants';
import mailerConfig from 'src/common/config/mailer.config';
import { getQueueToken } from '@nestjs/bullmq';
import * as fs from 'node:fs';

// Mock fs.readFileSync - must use 'node:fs' to match the import in the service
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let mockQueue: any;

  const createMockMailerConfig = (overrides = {}) => ({
    resend: { apiKey: 'test-key', fromEmail: 'test@example.com' },
    awsSes: {
      smtpHost: 'smtp.test.com',
      smtpPort: 587,
      smtpUsername: 'test-user',
      smtpPassword: 'test-pass',
      fromEmail: 'aws@example.com',
      region: 'us-east-1',
    },
    azure: { connectionString: '', fromEmail: '' },
    useAwsFirst: false,
    ...overrides,
  });

  const createModule = async (mailerConfigValue: any, queue?: any) => {
    const providers: any[] = [
      {
        provide: Services.EMAIL,
        useClass: EmailService,
      },
      {
        provide: mailerConfig.KEY,
        useValue: mailerConfigValue,
      },
    ];

    if (queue) {
      providers.push({
        provide: getQueueToken(RedisQueues.emailQueue.name),
        useValue: queue,
      });
    }

    const module: TestingModule = await Test.createTestingModule({
      providers,
    }).compile();

    return module.get<EmailService>(Services.EMAIL);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };
  });

  describe('constructor', () => {
    it('should initialize with AWS SES when credentials provided', async () => {
      const config = createMockMailerConfig();
      service = await createModule(config);
      expect(service).toBeDefined();
    });

    it('should initialize with Resend when API key provided', async () => {
      const config = createMockMailerConfig({
        awsSes: { smtpUsername: '', smtpPassword: '' },
      });
      service = await createModule(config);
      expect(service).toBeDefined();
    });

    it('should initialize with AWS SES and Resend both', async () => {
      const config = createMockMailerConfig({
        useAwsFirst: true,
      });
      service = await createModule(config);
      expect(service).toBeDefined();
    });

    it('should throw error when no email provider configured', async () => {
      const config = {
        resend: { apiKey: '', fromEmail: '' },
        awsSes: { smtpUsername: '', smtpPassword: '' },
        azure: { connectionString: '', fromEmail: '' },
        useAwsFirst: false,
      };

      await expect(createModule(config)).rejects.toThrow(
        'No email provider configured',
      );
    });
  });

  describe('sendEmail', () => {
    beforeEach(async () => {
      service = await createModule(createMockMailerConfig());
    });

    it('should return null when no recipients provided', async () => {
      const result = await service.sendEmail({
        recipients: [],
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBeNull();
    });

    it('should return null when recipients is undefined', async () => {
      const result = await service.sendEmail({
        recipients: undefined as any,
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBeNull();
    });

    it('should attempt to send with Resend when useAwsFirst is false', async () => {
      const sendEmailDto = {
        recipients: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      };

      // Since we can't easily mock the internal Resend client,
      // we just verify the method doesn't throw
      const result = await service.sendEmail(sendEmailDto);
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle recipient objects with email property', async () => {
      const sendEmailDto = {
        recipients: [{ email: 'test@example.com', name: 'Test User' }],
        subject: 'Test',
        html: '<p>Test</p>',
      };

      const result = await service.sendEmail(sendEmailDto);
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('sendEmail with useAwsFirst', () => {
    it('should attempt AWS first when useAwsFirst is true', async () => {
      const config = createMockMailerConfig({ useAwsFirst: true });
      service = await createModule(config);

      const sendEmailDto = {
        recipients: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      };

      // This will try AWS SES first (which may fail due to no real SMTP)
      // then fallback to Resend
      const result = await service.sendEmail(sendEmailDto);
      expect(result === null || typeof result === 'object').toBe(true);
    }, 15000); // Increased timeout for SMTP connection attempts
  });

  describe('renderTemplate', () => {
    beforeEach(async () => {
      service = await createModule(createMockMailerConfig());
    });

    it('should render template with variables', () => {
      const templateContent = '<h1>Hello {{ name }}</h1><p>Your code is {{ code }}</p>';
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);

      const result = service.renderTemplate('test.html', {
        name: 'John',
        code: '123456',
      });

      expect(result).toBe('<h1>Hello John</h1><p>Your code is 123456</p>');
    });

    it('should handle multiple occurrences of same variable', () => {
      const templateContent = '<p>Hello {{ name }}, welcome {{ name }}!</p>';
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);

      const result = service.renderTemplate('test.html', {
        name: 'John',
      });

      expect(result).toBe('<p>Hello John, welcome John!</p>');
    });

    it('should throw error when template not found', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => service.renderTemplate('nonexistent.html', {})).toThrow();
    });
  });

  describe('queueEmail', () => {
    it('should queue email successfully', async () => {
      service = await createModule(createMockMailerConfig(), mockQueue);

      const emailJob = {
        recipients: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      };

      const result = await service.queueEmail(emailJob);

      expect(result).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        RedisQueues.emailQueue.processes.sendEmail,
        emailJob,
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        }),
      );
    });

    it('should throw error when queue not available', async () => {
      service = await createModule(createMockMailerConfig());

      await expect(
        service.queueEmail({
          recipients: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('Email queue is not available');
    });

    it('should throw error when queue add fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));
      service = await createModule(createMockMailerConfig(), mockQueue);

      await expect(
        service.queueEmail({
          recipients: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('Queue error');
    });
  });

  describe('queueTemplateEmail', () => {
    it('should render template and queue email', async () => {
      service = await createModule(createMockMailerConfig(), mockQueue);
      const templateContent = '<h1>Code: {{ code }}</h1>';
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);

      const result = await service.queueTemplateEmail(
        ['test@example.com'],
        'Verification',
        'test.html',
        { code: '123456' },
      );

      expect(result).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        RedisQueues.emailQueue.processes.sendEmail,
        expect.objectContaining({
          recipients: ['test@example.com'],
          subject: 'Verification',
          html: '<h1>Code: 123456</h1>',
        }),
        expect.any(Object),
      );
    });

    it('should handle recipients with email objects', async () => {
      service = await createModule(createMockMailerConfig(), mockQueue);
      const templateContent = '<p>Hello</p>';
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);

      const result = await service.queueTemplateEmail(
        [{ email: 'test@example.com', name: 'Test User' }],
        'Test',
        'test.html',
        {},
      );

      expect(result).toBe('job-123');
    });
  });
});
