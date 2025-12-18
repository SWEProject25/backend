import { Test, TestingModule } from '@nestjs/testing';
import { HashtagTrendService } from './hashtag-trends.service';
import { Services } from 'src/utils/constants';
import { TrendCategory } from '../enums/trend-category.enum';

describe('HashtagTrendService', () => {
  let service: HashtagTrendService;
  let prisma: any;
  let redisService: any;
  let redisTrendingService: any;
  let personalizedTrendsService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      hashtag: {
        findMany: jest.fn(),
      },
      hashtagTrend: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockRedisService = {
      getJSON: jest.fn(),
      setJSON: jest.fn(),
      delPattern: jest.fn(),
    };

    const mockRedisTrendingService = {
      trackPostHashtags: jest.fn(),
      getTrending: jest.fn(),
      getHashtagCounts: jest.fn(),
      batchGetHashtagMetadata: jest.fn(),
      batchGetHashtagCounts: jest.fn(),
      setHashtagMetadata: jest.fn(),
    };

    const mockPersonalizedTrendsService = {
      getPersonalizedTrending: jest.fn(),
      trackUserActivity: jest.fn(),
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
          provide: Services.REDIS_TRENDING,
          useValue: mockRedisTrendingService,
        },
        {
          provide: Services.PERSONALIZED_TRENDS,
          useValue: mockPersonalizedTrendsService,
        },
      ],
    }).compile();

    service = module.get<HashtagTrendService>(HashtagTrendService);
    prisma = module.get(Services.PRISMA);
    redisService = module.get(Services.REDIS);
    redisTrendingService = module.get(Services.REDIS_TRENDING);
    personalizedTrendsService = module.get(Services.PERSONALIZED_TRENDS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackPostHashtags', () => {
    it('should not track when hashtagIds is empty', async () => {
      await service.trackPostHashtags(1, [], [TrendCategory.GENERAL]);

      expect(redisTrendingService.trackPostHashtags).not.toHaveBeenCalled();
    });

    it('should track hashtags for specified categories', async () => {
      const hashtagIds = [1, 2, 3];
      const categories = [TrendCategory.GENERAL, TrendCategory.NEWS];

      await service.trackPostHashtags(1, hashtagIds, categories);

      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledTimes(2);
      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledWith(
        1,
        hashtagIds,
        TrendCategory.GENERAL,
        undefined,
      );
      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledWith(
        1,
        hashtagIds,
        TrendCategory.NEWS,
        undefined,
      );
    });

    it('should filter out PERSONALIZED category', async () => {
      const hashtagIds = [1, 2];
      const categories = [TrendCategory.GENERAL, TrendCategory.PERSONALIZED];

      await service.trackPostHashtags(1, hashtagIds, categories);

      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledTimes(1);
      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledWith(
        1,
        hashtagIds,
        TrendCategory.GENERAL,
        undefined,
      );
    });

    it('should throw error when tracking fails', async () => {
      redisTrendingService.trackPostHashtags.mockRejectedValue(new Error('Redis error'));

      await expect(service.trackPostHashtags(1, [1], [TrendCategory.GENERAL])).rejects.toThrow(
        'Redis error',
      );
    });
  });

  describe('syncTrendToDB', () => {
    const hashtagId = 1;

    it('should sync trend to database', async () => {
      redisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 2,
        count24h: 3,
        count7d: 4,
      });
      prisma.hashtagTrend.create.mockResolvedValue({});

      const result = await service.syncTrendToDB(hashtagId, TrendCategory.GENERAL);

      // Score = 2 * 10 + 3 * 2 + 4 * 0.5 = 20 + 6 + 2 = 28
      expect(result).toBe(28);
      expect(prisma.hashtagTrend.create).toHaveBeenCalled();
    });

    it('should update existing trend on duplicate', async () => {
      redisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 1,
        count24h: 2,
        count7d: 3,
      });
      prisma.hashtagTrend.create.mockRejectedValue({ code: 'P2002' });
      prisma.hashtagTrend.update.mockResolvedValue({});

      const result = await service.syncTrendToDB(hashtagId, TrendCategory.GENERAL);

      expect(result).toBe(1 * 10 + 2 * 2 + 3 * 0.5); // 10 + 4 + 1.5 = 15.5
      expect(prisma.hashtagTrend.update).toHaveBeenCalled();
    });

    it('should throw error on non-duplicate failure', async () => {
      redisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 1,
        count24h: 2,
        count7d: 3,
      });
      prisma.hashtagTrend.create.mockRejectedValue(new Error('Database error'));

      await expect(service.syncTrendToDB(hashtagId, TrendCategory.GENERAL)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getTrending', () => {
    const userId = 1;

    it('should return cached trends if available', async () => {
      const cachedData = [{ tag: '#test', totalPosts: 10 }];
      redisService.getJSON.mockResolvedValue(cachedData);

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual(cachedData);
      expect(redisTrendingService.getTrending).not.toHaveBeenCalled();
    });

    it('should fetch from Redis when cache is empty', async () => {
      redisService.getJSON.mockResolvedValue(null);
      redisTrendingService.getTrending.mockResolvedValue([
        { hashtagId: 1, score: 100 },
      ]);
      redisTrendingService.batchGetHashtagMetadata.mockResolvedValue(
        new Map([[1, { tag: 'trending', hashtagId: 1 }]]),
      );
      redisTrendingService.batchGetHashtagCounts.mockResolvedValue(
        new Map([[1, { count1h: 5, count24h: 20, count7d: 50 }]]),
      );

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual([{ tag: '#trending', totalPosts: 50, score: 100 }]);
      expect(redisService.setJSON).toHaveBeenCalled();
    });

    it('should fallback to DB when Redis returns empty', async () => {
      redisService.getJSON.mockResolvedValue(null);
      redisTrendingService.getTrending.mockResolvedValue([]);
      prisma.hashtagTrend.findMany.mockResolvedValue([]);

      const result = await service.getTrending(10, TrendCategory.GENERAL, userId);

      expect(result).toEqual([]);
    });

    it('should use personalized service for PERSONALIZED category', async () => {
      const personalizedTrends = [{ tag: '#personal', totalPosts: 5 }];
      personalizedTrendsService.getPersonalizedTrending.mockResolvedValue(personalizedTrends);
      personalizedTrendsService.trackUserActivity.mockResolvedValue(undefined);

      const result = await service.getTrending(10, TrendCategory.PERSONALIZED, userId);

      expect(result).toEqual(personalizedTrends);
      expect(personalizedTrendsService.getPersonalizedTrending).toHaveBeenCalledWith(userId, 10);
    });

    it('should fallback to GENERAL when PERSONALIZED requested without userId', async () => {
      redisService.getJSON.mockResolvedValue([{ tag: '#general', totalPosts: 10 }]);

      const result = await service.getTrending(10, TrendCategory.PERSONALIZED, undefined);

      expect(result).toEqual([{ tag: '#general', totalPosts: 10 }]);
      expect(personalizedTrendsService.getPersonalizedTrending).not.toHaveBeenCalled();
    });
  });

  describe('syncTrendingToDB', () => {
    it('should sync trending hashtags from Redis to DB', async () => {
      redisTrendingService.getTrending.mockResolvedValue([
        { hashtagId: 1, score: 100 },
        { hashtagId: 2, score: 50 },
      ]);
      redisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 1,
        count24h: 2,
        count7d: 3,
      });
      prisma.hashtagTrend.create.mockResolvedValue({});

      const result = await service.syncTrendingToDB(TrendCategory.GENERAL, 10);

      expect(result).toBe(2);
      expect(redisService.delPattern).toHaveBeenCalled();
    });

    it('should return 0 when no trending hashtags in Redis', async () => {
      redisTrendingService.getTrending.mockResolvedValue([]);

      const result = await service.syncTrendingToDB(TrendCategory.GENERAL, 10);

      expect(result).toBe(0);
    });

    it('should return 0 for PERSONALIZED category', async () => {
      const result = await service.syncTrendingToDB(TrendCategory.PERSONALIZED, 10);

      expect(result).toBe(0);
      expect(redisTrendingService.getTrending).not.toHaveBeenCalled();
    });
  });

  describe('handlePostCreated', () => {
    it('should skip when no hashtag IDs provided', async () => {
      await service.handlePostCreated({
        postId: 1,
        userId: 1,
        hashtagIds: [],
        timestamp: Date.now(),
      });

      expect(redisTrendingService.trackPostHashtags).not.toHaveBeenCalled();
    });

    it('should track hashtags for post', async () => {
      const event = {
        postId: 1,
        userId: 1,
        hashtagIds: [1, 2],
        timestamp: Date.now(),
      };

      await service.handlePostCreated(event);

      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledWith(
        1,
        [1, 2],
        TrendCategory.GENERAL,
        event.timestamp,
      );
    });

    it('should add category based on interest slug', async () => {
      const event = {
        postId: 1,
        userId: 1,
        hashtagIds: [1],
        interestSlug: 'sports',
        timestamp: Date.now(),
      };

      await service.handlePostCreated(event);

      expect(redisTrendingService.trackPostHashtags).toHaveBeenCalledTimes(2);
    });
  });
});
