import { Test, TestingModule } from '@nestjs/testing';
import { RedisTrendingService } from './redis-trending.service';
import { RedisService } from 'src/redis/redis.service';
import { Services } from 'src/utils/constants';
import { TrendCategory } from '../enums/trend-category.enum';

describe('RedisTrendingService', () => {
  let service: RedisTrendingService;
  let redisService: jest.Mocked<RedisService>;

  const mockRedisService = {
    get: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    zAdd: jest.fn(),
    zCount: jest.fn(),
    zRem: jest.fn(),
    zRangeWithScores: jest.fn(),
    zRemRangeByRank: jest.fn(),
    zRemRangeByScore: jest.fn(),
    setJSON: jest.fn(),
    getJSON: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisTrendingService,
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RedisTrendingService>(RedisTrendingService);
    redisService = module.get(Services.REDIS);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackHashtagPost', () => {
    it('should track a hashtag post successfully', async () => {
      mockRedisService.incr.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(true);
      mockRedisService.zAdd.mockResolvedValue(1);

      await service.trackHashtagPost(1, 100, TrendCategory.GENERAL);

      expect(mockRedisService.incr).toHaveBeenCalled();
      expect(mockRedisService.expire).toHaveBeenCalled();
      expect(mockRedisService.zAdd).toHaveBeenCalled();
    });

    it('should throw error when redis fails', async () => {
      mockRedisService.incr.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.trackHashtagPost(1, 100, TrendCategory.GENERAL),
      ).rejects.toThrow('Redis error');
    });

    it('should use provided timestamp', async () => {
      mockRedisService.incr.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(true);
      mockRedisService.zAdd.mockResolvedValue(1);

      const timestamp = Date.now() - 1000;
      await service.trackHashtagPost(1, 100, TrendCategory.SPORTS, timestamp);

      expect(mockRedisService.zAdd).toHaveBeenCalled();
    });
  });

  describe('getTrending', () => {
    it('should return trending hashtags', async () => {
      mockRedisService.zRangeWithScores.mockResolvedValue([
        { value: '1', score: 100 },
        { value: '2', score: 80 },
      ]);

      const result = await service.getTrending(TrendCategory.GENERAL, 10);

      expect(result).toEqual([
        { hashtagId: 1, score: 100 },
        { hashtagId: 2, score: 80 },
      ]);
    });

    it('should use default limit of 10', async () => {
      mockRedisService.zRangeWithScores.mockResolvedValue([]);

      await service.getTrending(TrendCategory.GENERAL);

      expect(mockRedisService.zRangeWithScores).toHaveBeenCalledWith(
        expect.any(String),
        0,
        9,
        { REV: true },
      );
    });

    it('should throw error when redis fails', async () => {
      mockRedisService.zRangeWithScores.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.getTrending(TrendCategory.GENERAL),
      ).rejects.toThrow('Redis error');
    });
  });

  describe('getHashtagCounts', () => {
    it('should return cached counts when valid cache exists', async () => {
      const cachedCounts = {
        count1h: 10,
        count24h: 50,
        count7d: 200,
        timestamp: Date.now() - 60000, // 1 minute ago
      };
      mockRedisService.getJSON.mockResolvedValue(cachedCounts);

      const result = await service.getHashtagCounts(1, TrendCategory.GENERAL);

      expect(result).toEqual({
        count1h: 10,
        count24h: 50,
        count7d: 200,
      });
      expect(mockRedisService.get).not.toHaveBeenCalled();
    });

    it('should fetch fresh counts when cache is stale', async () => {
      mockRedisService.getJSON.mockResolvedValue({
        count1h: 10,
        count24h: 50,
        count7d: 200,
        timestamp: Date.now() - 400000, // Older than cache TTL
      });
      mockRedisService.get.mockResolvedValue('15');
      mockRedisService.zCount.mockResolvedValue(250);
      mockRedisService.setJSON.mockResolvedValue(undefined);

      const result = await service.getHashtagCounts(1, TrendCategory.GENERAL);

      expect(result.count7d).toBe(250);
      expect(mockRedisService.setJSON).toHaveBeenCalled();
    });

    it('should fetch fresh counts when no cache exists', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);
      mockRedisService.get.mockResolvedValue('5');
      mockRedisService.zCount.mockResolvedValue(100);
      mockRedisService.setJSON.mockResolvedValue(undefined);

      const result = await service.getHashtagCounts(1, TrendCategory.GENERAL);

      expect(result).toEqual({
        count1h: 5,
        count24h: 5,
        count7d: 100,
      });
    });

    it('should throw error when redis fails', async () => {
      mockRedisService.getJSON.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.getHashtagCounts(1, TrendCategory.GENERAL),
      ).rejects.toThrow('Redis error');
    });
  });

  describe('batchGetHashtagCounts', () => {
    it('should return counts for multiple hashtags', async () => {
      mockRedisService.getJSON.mockResolvedValue({
        count1h: 10,
        count24h: 50,
        count7d: 200,
        timestamp: Date.now(),
      });

      const result = await service.batchGetHashtagCounts([1, 2, 3], TrendCategory.GENERAL);

      expect(result.size).toBe(3);
      expect(result.get(1)).toBeDefined();
      expect(result.get(2)).toBeDefined();
      expect(result.get(3)).toBeDefined();
    });
  });

  describe('setHashtagMetadata', () => {
    it('should set metadata successfully', async () => {
      mockRedisService.setJSON.mockResolvedValue(undefined);

      await service.setHashtagMetadata(1, '#test', TrendCategory.GENERAL);

      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        expect.any(String),
        { tag: '#test', hashtagId: 1 },
        expect.any(Number),
      );
    });

    it('should throw error when redis fails', async () => {
      mockRedisService.setJSON.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.setHashtagMetadata(1, '#test', TrendCategory.GENERAL),
      ).rejects.toThrow('Redis error');
    });
  });

  describe('getHashtagMetadata', () => {
    it('should return metadata when exists', async () => {
      mockRedisService.getJSON.mockResolvedValue({ tag: '#test', hashtagId: 1 });

      const result = await service.getHashtagMetadata(1, TrendCategory.GENERAL);

      expect(result).toEqual({ tag: '#test', hashtagId: 1 });
    });

    it('should return null when metadata does not exist', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);

      const result = await service.getHashtagMetadata(1, TrendCategory.GENERAL);

      expect(result).toBeNull();
    });

    it('should return null when redis fails', async () => {
      mockRedisService.getJSON.mockRejectedValue(new Error('Redis error'));

      const result = await service.getHashtagMetadata(1, TrendCategory.GENERAL);

      expect(result).toBeNull();
    });
  });

  describe('batchGetHashtagMetadata', () => {
    it('should return metadata for multiple hashtags', async () => {
      mockRedisService.getJSON
        .mockResolvedValueOnce({ tag: '#test1', hashtagId: 1 })
        .mockResolvedValueOnce({ tag: '#test2', hashtagId: 2 })
        .mockResolvedValueOnce(null);

      const result = await service.batchGetHashtagMetadata([1, 2, 3], TrendCategory.GENERAL);

      expect(result.size).toBe(2);
      expect(result.get(1)).toEqual({ tag: '#test1', hashtagId: 1 });
      expect(result.get(2)).toEqual({ tag: '#test2', hashtagId: 2 });
      expect(result.has(3)).toBe(false);
    });
  });

  describe('trackPostHashtags', () => {
    it('should track multiple hashtags for a post', async () => {
      mockRedisService.incr.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(true);
      mockRedisService.zAdd.mockResolvedValue(1);

      await service.trackPostHashtags(100, [1, 2, 3], TrendCategory.GENERAL);

      // Each hashtag tracking calls incr multiple times
      expect(mockRedisService.incr).toHaveBeenCalled();
    });

    it('should return early when hashtagIds is empty', async () => {
      await service.trackPostHashtags(100, [], TrendCategory.GENERAL);

      expect(mockRedisService.incr).not.toHaveBeenCalled();
    });

    it('should throw error when tracking fails', async () => {
      mockRedisService.incr.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.trackPostHashtags(100, [1], TrendCategory.GENERAL),
      ).rejects.toThrow('Redis error');
    });
  });

  describe('cleanupOldEntries', () => {
    it('should remove old entries from sorted set', async () => {
      mockRedisService.zRemRangeByScore.mockResolvedValue(5);

      await service.cleanupOldEntries(1, TrendCategory.GENERAL);

      expect(mockRedisService.zRemRangeByScore).toHaveBeenCalled();
    });

    it('should not throw when cleanup fails', async () => {
      mockRedisService.zRemRangeByScore.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await service.cleanupOldEntries(1, TrendCategory.GENERAL);
    });
  });

  describe('forceScoreUpdate', () => {
    it('should call updateTrendingScore', async () => {
      mockRedisService.get.mockResolvedValue('10');
      mockRedisService.zCount.mockResolvedValue(50);
      mockRedisService.zAdd.mockResolvedValue(1);
      mockRedisService.zRemRangeByRank.mockResolvedValue(0);
      mockRedisService.setJSON.mockResolvedValue(undefined);
      mockRedisService.zRemRangeByScore.mockResolvedValue(0);

      const score = await service.forceScoreUpdate(1, TrendCategory.GENERAL);

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateTrendingScore', () => {
    it('should calculate and update score correctly', async () => {
      mockRedisService.get.mockResolvedValue('10');
      mockRedisService.zCount.mockResolvedValue(50);
      mockRedisService.zAdd.mockResolvedValue(1);
      mockRedisService.zRemRangeByRank.mockResolvedValue(0);
      mockRedisService.setJSON.mockResolvedValue(undefined);
      mockRedisService.zRemRangeByScore.mockResolvedValue(0);

      const score = await service.updateTrendingScore(1, TrendCategory.GENERAL);

      // Score = 10*10 + 10*2 + 50*0.5 = 100 + 20 + 25 = 145
      expect(score).toBe(145);
      expect(mockRedisService.zAdd).toHaveBeenCalled();
    });

    it('should remove hashtag from trending when score is 0', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.zCount.mockResolvedValue(0);
      mockRedisService.zRem.mockResolvedValue(1);
      mockRedisService.zRemRangeByScore.mockResolvedValue(0);

      const score = await service.updateTrendingScore(1, TrendCategory.GENERAL);

      expect(score).toBe(0);
      expect(mockRedisService.zRem).toHaveBeenCalled();
    });

    it('should throw error when redis fails', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.updateTrendingScore(1, TrendCategory.GENERAL),
      ).rejects.toThrow('Redis error');
    });
  });
});
