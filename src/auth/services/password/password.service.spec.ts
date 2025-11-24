import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';
import { Services } from 'src/utils/constants';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.PASSWORD,
          useClass: PasswordService,
        },
        {
          provide: Services.USER,
          useValue: {},
        },
        {
          provide: Services.EMAIL,
          useValue: {},
        },
        {
          provide: Services.REDIS,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PasswordService>(Services.PASSWORD);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
