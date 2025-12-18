import { Test, TestingModule } from '@nestjs/testing';
import { HashtagController } from './hashtag.controller';
import { Services } from 'src/utils/constants';

describe('HashtagController', () => {
  let controller: HashtagController;

  const mockHashtagTrendService = {
    getTrending: jest.fn(),
    recalculateTrends: jest.fn(),
  };

  const mockPersonalizedTrendsService = {
    getPersonalizedTrending: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HashtagController],
      providers: [
        {
          provide: Services.HASHTAG_TRENDS,
          useValue: mockHashtagTrendService,
        },
        {
          provide: Services.PERSONALIZED_TRENDS,
          useValue: mockPersonalizedTrendsService,
        },
      ],
    }).compile();

    controller = module.get<HashtagController>(HashtagController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
