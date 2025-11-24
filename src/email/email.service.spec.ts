import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { Services } from 'src/utils/constants';
import mailerConfig from 'src/common/config/mailer.config';

describe('EmailService', () => {
  let service: EmailService;

  const mockMailerConfig = {
    resend: { apiKey: 'test-key', fromEmail: 'test@example.com' },
    awsSes: {
      smtpHost: 'smtp.test.com',
      smtpPort: 587,
      smtpUsername: 'test',
      smtpPassword: 'test',
      fromEmail: 'test@example.com',
      region: 'us-east-1',
    },
    azure: { connectionString: '', fromEmail: '' },
    useAwsFirst: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.EMAIL,
          useClass: EmailService,
        },
        {
          provide: mailerConfig.KEY,
          useValue: mockMailerConfig,
        },
      ],
    }).compile();

    service = module.get<EmailService>(Services.EMAIL);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
