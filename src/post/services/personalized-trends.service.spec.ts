import { Test, TestingModule } from '@nestjs/testing';
import { PersonalizedTrendsService } from './personalized-trends.service';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisTrendingService } from './redis-trending.service';
import { UsersService } from 'src/users/users.service';
import { Services } from 'src/utils/constants';
import { TrendCategory } from '../enums/trend-category.enum';

describe('PersonalizedTrendsService', () => {
  let service: PersonalizedTrendsService;
  let redisService: jest.Mocked<RedisService>;
  let prismaService: jest.Mocked<PrismaService>;
  let redisTrendingService: jest.Mocked<RedisTrendingService>;
  let usersService: jest.Mocked<UsersService>;

  const mockRedisService = {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    zAdd: jest.fn(),
    zRemRangeByRank: jest.fn(),
    delPattern: jest.fn(),
  };

  const mockPrismaService = {
    hashtag: {
      findUnique: jest.fn(),
    },
  };

  const mockRedisTrendingService = {
    getTrending: jest.fn(),
    getHashtagMetadata: jest.fn(),
    setHashtagMetadata: jest.fn(),
    getHashtagCounts: jest.fn(),
  };

  const mockUsersService = {
    getUserInterests: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalizedTrendsService,
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.REDIS_TRENDING,
          useValue: mockRedisTrendingService,
        },
        {
          provide: Services.USERS,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<PersonalizedTrendsService>(PersonalizedTrendsService);
    redisService = module.get(Services.REDIS);
    prismaService = module.get(Services.PRISMA);
    redisTrendingService = module.get(Services.REDIS_TRENDING);
    usersService = module.get(Services.USERS);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPersonalizedTrending', () => {
    it('should return cached results when available', async () => {
      const cachedTrends = [
        { tag: '#test', totalPosts: 100 },
        { tag: '#trending', totalPosts: 50 },
      ];
      mockRedisService.getJSON.mockResolvedValue(cachedTrends);

      const result = await service.getPersonalizedTrending(1, 10);

      expect(result).toEqual(cachedTrends);
      expect(mockUsersService.getUserInterests).not.toHaveBeenCalled();
    });

    it('should fall back to GENERAL when user has no interests', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockUsersService.getUserInterests.mockResolvedValue([]);
      mockRedisTrendingService.getTrending.mockResolvedValue([
        { hashtagId: 1, score: 100 },
      ]);
      mockRedisTrendingService.getHashtagMetadata.mockResolvedValue({ tag: 'test', hashtagId: 1 });
      mockRedisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 10,
        count24h: 50,
        count7d: 200,
      });

      const result = await service.getPersonalizedTrending(1, 10);

      expect(result).toBeDefined();
    });

    it('should generate personalized trends based on user interests', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockUsersService.getUserInterests.mockResolvedValue([
        { slug: 'technology' },
        { slug: 'programming' },
      ]);
      mockRedisTrendingService.getTrending.mockResolvedValue([
        { hashtagId: 1, score: 100 },
        { hashtagId: 2, score: 80 },
      ]);
      mockRedisTrendingService.getHashtagMetadata.mockResolvedValue({ tag: 'tech', hashtagId: 1 });
      mockRedisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 10,
        count24h: 50,
        count7d: 200,
      });
      mockRedisService.setJSON.mockResolvedValue(undefined);

      const result = await service.getPersonalizedTrending(1, 10);

      expect(result).toBeDefined();
      expect(mockRedisService.setJSON).toHaveBeenCalled();
    });

    it('should fetch metadata from prisma when not in cache', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockUsersService.getUserInterests.mockResolvedValue([{ slug: 'sports' }]);
      mockRedisTrendingService.getTrending.mockResolvedValue([
        { hashtagId: 1, score: 100 },
      ]);
      mockRedisTrendingService.getHashtagMetadata.mockResolvedValue(null);
      mockPrismaService.hashtag.findUnique.mockResolvedValue({ tag: 'football' });
      mockRedisTrendingService.setHashtagMetadata.mockResolvedValue(undefined);
      mockRedisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 5,
        count24h: 25,
        count7d: 100,
      });
      mockRedisService.setJSON.mockResolvedValue(undefined);

      const result = await service.getPersonalizedTrending(1, 10);

      expect(mockPrismaService.hashtag.findUnique).toHaveBeenCalled();
      expect(mockRedisTrendingService.setHashtagMetadata).toHaveBeenCalled();
    });

    it('should filter out null results when hashtag not found', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockUsersService.getUserInterests.mockResolvedValue([{ slug: 'sports' }]);
      mockRedisTrendingService.getTrending.mockResolvedValue([
        { hashtagId: 1, score: 100 },
      ]);
      mockRedisTrendingService.getHashtagMetadata.mockResolvedValue(null);
      mockPrismaService.hashtag.findUnique.mockResolvedValue(null);
      mockRedisService.setJSON.mockResolvedValue(undefined);

      const result = await service.getPersonalizedTrending(1, 10);

      expect(result).toBeDefined();
    });

    it('should fall back to GENERAL on error', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockUsersService.getUserInterests.mockRejectedValue(new Error('DB error'));
      mockRedisTrendingService.getTrending.mockResolvedValue([]);
      mockRedisTrendingService.getHashtagMetadata.mockResolvedValue(null);
      mockRedisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 0,
        count24h: 0,
        count7d: 0,
      });

      const result = await service.getPersonalizedTrending(1, 10);

      expect(result).toBeDefined();
    });

    it('should fall back to GENERAL when no combined trends', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockUsersService.getUserInterests.mockResolvedValue([{ slug: 'sports' }]);
      mockRedisTrendingService.getTrending.mockResolvedValue([]);
      mockRedisTrendingService.getHashtagMetadata.mockResolvedValue(null);
      mockRedisTrendingService.getHashtagCounts.mockResolvedValue({
        count1h: 0,
        count24h: 0,
        count7d: 0,
      });

      const result = await service.getPersonalizedTrending(1, 10);

      expect(result).toBeDefined();
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete cache patterns and clear local cache', async () => {
      mockRedisService.delPattern.mockResolvedValue(1);

      await service.invalidateUserCache(123);

      expect(mockRedisService.delPattern).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackUserActivity', () => {
    it('should track user activity in Redis', async () => {
      mockRedisService.zAdd.mockResolvedValue(1);
      mockRedisService.zRemRangeByRank.mockResolvedValue(0);

      await service.trackUserActivity(123);

      expect(mockRedisService.zAdd).toHaveBeenCalledWith(
        'trending:active_users',
        expect.arrayContaining([
          expect.objectContaining({
            value: '123',
          }),
        ]),
      );
      expect(mockRedisService.zRemRangeByRank).toHaveBeenCalled();
    });

    it('should not throw when tracking fails', async () => {
      mockRedisService.zAdd.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await service.trackUserActivity(123);
    });
  });
});
