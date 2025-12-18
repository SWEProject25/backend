import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { Services } from 'src/utils/constants';
import redisConfig from 'src/config/redis.config';

describe('RedisService', () => {
  let service: RedisService;

  const mockRedisConfig = {
    redisHost: 'localhost',
    redisPort: 6379,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.REDIS,
          useClass: RedisService,
        },
        {
          provide: redisConfig.KEY,
          useValue: mockRedisConfig,
        },
      ],
    }).compile();

    service = module.get<RedisService>(Services.REDIS);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
