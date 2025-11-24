import { Test, TestingModule } from '@nestjs/testing';
import { JwtTokenService } from './jwt-token.service';
import { JwtService } from '@nestjs/jwt';
import { Services } from 'src/utils/constants';

describe('JwtTokenService', () => {
  let service: JwtTokenService;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.JWT_TOKEN,
          useClass: JwtTokenService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<JwtTokenService>(Services.JWT_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
