import { Test, TestingModule } from '@nestjs/testing';
import { HashtagTrendService } from './hashtag-trends.service';
import { Services, RedisQueues } from 'src/utils/constants';
import { getQueueToken } from '@nestjs/bullmq';
import { TrendCategory } from '../enums/trend-category.enum';

describe('HashtagTrendService', () => {
  let service: HashtagTrendService;
  let prisma: any;
  let redisService: any;
  let trendingQueue: any;
  let usersService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      post: {
        findMany: jest.fn(),
      },
      hashtag: {
        findMany: jest.fn(),
      },
      hashtagTrend: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const mockRedisService = {
      getJSON: jest.fn(),
      setJSON: jest.fn(),
      delPattern: jest.fn(),
    };

    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const mockUsersService = {
      getUserInterests: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashtagTrendService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
        {
          provide: getQueueToken(RedisQueues.hashTagQueue.name),
          useValue: mockQueue,
        },
        {
          provide: Services.USERS,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<HashtagTrendService>(HashtagTrendService);
    prisma = module.get(Services.PRISMA);
    redisService = module.get(Services.REDIS);
    trendingQueue = module.get(getQueueToken(RedisQueues.hashTagQueue.name));
    usersService = module.get(Services.USERS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queueTrendCalculation', () => {
    it('should not queue when hashtagIds is empty', async () => {
      await service.queueTrendCalculation([]);

      expect(trendingQueue.add).not.toHaveBeenCalled();
    });

    it('should queue trend calculation for hashtags', async () => {
      const hashtagIds = [1, 2, 3];

      await service.queueTrendCalculation(hashtagIds);

      expect(trendingQueue.add).toHaveBeenCalledWith(
        RedisQueues.hashTagQueue.processes.calculateTrends,
        { hashtagIds },
        expect.objectContaining({
          delay: 5000,
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        }),
      );
    });

    it('should throw error when queue fails', async () => {
      trendingQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(service.queueTrendCalculation([1, 2])).rejects.toThrow('Queue error');
    });
  });

  describe('calculateTrend', () => {
    const hashtagId = 1;

    it('should return 0 for personalized category without userId', async () => {
      const result = await service.calculateTrend(hashtagId, TrendCategory.PERSONALIZED, null);

      expect(result).toBe(0);
    });

    it('should calculate trend score correctly', async () => {
      prisma.post.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // 1h posts
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]) // 24h posts
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]); // 7d posts

      prisma.hashtagTrend.upsert.mockResolvedValue({});

      const result = await service.calculateTrend(hashtagId, TrendCategory.GENERAL, null);

      // Score = 2 * 10 + 3 * 2 + 4 * 0.5 = 20 + 6 + 2 = 28
      expect(result).toBe(28);
      expect(prisma.hashtagTrend.upsert).toHaveBeenCalled();
    });

    it('should filter by user interests when userId provided', async () => {
      usersService.getUserInterests.mockResolvedValue([{ slug: 'tech' }]);
      prisma.post.findMany
        .mockResolvedValueOnce([{ id: 1, Interest: { slug: 'tech' } }])
        .mockResolvedValueOnce([{ id: 1, Interest: { slug: 'tech' } }])
        .mockResolvedValueOnce([{ id: 1, Interest: { slug: 'tech' } }, { id: 2, Interest: { slug: 'sports' } }]);

      prisma.hashtagTrend.upsert.mockResolvedValue({});

      const result = await service.calculateTrend(hashtagId, TrendCategory.PERSONALIZED, 1);

      expect(usersService.getUserInterests).toHaveBeenCalledWith(1);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should throw error on calculation failure', async () => {
      prisma.post.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.calculateTrend(hashtagId, TrendCategory.GENERAL, null)).rejects.toThrow('Database error');
    });
  });

  describe('getTrending', () => {
    const userId = 1;

    it('should return cached trends if available', async () => {
      const cachedData = [{ tag: '#test', totalPosts: 10 }];
      redisService.getJSON.mockResolvedValue(cachedData);

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual(cachedData);
      expect(prisma.hashtagTrend.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database when cache is empty', async () => {
      redisService.getJSON.mockResolvedValue(null);

      const mockTrends = [
        {
          hashtag: { tag: 'trending' },
          post_count_7d: 50,
        },
      ];
      prisma.hashtagTrend.findMany.mockResolvedValue(mockTrends);

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual([{ tag: '#trending', totalPosts: 50 }]);
      expect(redisService.setJSON).toHaveBeenCalled();
    });

    it('should trigger recalculation when no trends found', async () => {
      redisService.getJSON.mockResolvedValue(null);
      prisma.hashtagTrend.findMany.mockResolvedValue([]);
      prisma.hashtag.findMany.mockResolvedValue([]);

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual([]);
      // Recalculation is triggered in background
    });

    it('should handle cached as empty array', async () => {
      redisService.getJSON.mockResolvedValue([]);
      prisma.hashtagTrend.findMany.mockResolvedValue([]);
      prisma.hashtag.findMany.mockResolvedValue([]);

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual([]);
    });
  });

  describe('recalculateTrends', () => {
    it('should recalculate trends for active hashtags', async () => {
      const activeHashtags = [{ id: 1 }, { id: 2 }];
      prisma.hashtag.findMany.mockResolvedValue(activeHashtags);

      const result = await service.recalculateTrends(TrendCategory.GENERAL);

      expect(result).toBe(2);
      expect(trendingQueue.add).toHaveBeenCalled();
      expect(redisService.delPattern).toHaveBeenCalled();
    });

    it('should return 0 when no active hashtags', async () => {
      prisma.hashtag.findMany.mockResolvedValue([]);

      const result = await service.recalculateTrends(TrendCategory.GENERAL);

      expect(result).toBe(0);
      expect(trendingQueue.add).not.toHaveBeenCalled();
    });

    it('should filter by user interests for personalized category', async () => {
      usersService.getUserInterests.mockResolvedValue([{ slug: 'tech' }]);
      prisma.hashtag.findMany.mockResolvedValue([{ id: 1 }]);

      await service.recalculateTrends(TrendCategory.PERSONALIZED, 1);

      expect(usersService.getUserInterests).toHaveBeenCalledWith(1);
    });
  });
});
