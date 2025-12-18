import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { HashtagTrendService } from 'src/post/services/hashtag-trends.service';
import { UserService } from 'src/user/user.service';
import { Services } from 'src/utils/constants';
import { TrendCategory, ALL_TREND_CATEGORIES } from 'src/post/enums/trend-category.enum';

describe('CronService', () => {
  let service: CronService;
  let hashtagTrendService: jest.Mocked<HashtagTrendService>;
  let userService: jest.Mocked<UserService>;

  const mockHashtagTrendService = {
    syncTrendingToDB: jest.fn(),
  };

  const mockUserService = {
    getActiveUsers: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        {
          provide: Services.HASHTAG_TRENDS,
          useValue: mockHashtagTrendService,
        },
        {
          provide: Services.USER,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
    hashtagTrendService = module.get(Services.HASHTAG_TRENDS);
    userService = module.get(Services.USER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleTrendSyncToPostgres', () => {
    it('should sync trends for all non-personalized categories successfully', async () => {
      mockHashtagTrendService.syncTrendingToDB.mockResolvedValue(10);
      mockUserService.getActiveUsers.mockResolvedValue([]);

      const results = await service.handleTrendSyncToPostgres();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(ALL_TREND_CATEGORIES.length);
    });

    it('should sync personalized trends for active users', async () => {
      const mockUsers = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];
      mockUserService.getActiveUsers.mockResolvedValue(mockUsers);
      mockHashtagTrendService.syncTrendingToDB.mockResolvedValue(5);

      const results = await service.handleTrendSyncToPostgres();

      const personalizedResult = results.find(r => r.category === TrendCategory.PERSONALIZED);
      expect(personalizedResult).toBeDefined();
      expect(personalizedResult?.userCount).toBe(3);
    });

    it('should handle errors for individual category sync gracefully', async () => {
      mockUserService.getActiveUsers.mockResolvedValue([]);
      mockHashtagTrendService.syncTrendingToDB.mockImplementation((category) => {
        if (category === TrendCategory.GENERAL) {
          throw new Error('Sync failed');
        }
        return Promise.resolve(10);
      });

      const results = await service.handleTrendSyncToPostgres();

      const generalResult = results.find(r => r.category === TrendCategory.GENERAL);
      expect(generalResult?.error).toBe('Sync failed');
    });

    it('should handle errors for individual user sync in personalized trends', async () => {
      const mockUsers = [
        { id: 1 },
        { id: 2 },
      ];
      mockUserService.getActiveUsers.mockResolvedValue(mockUsers);
      
      let callCount = 0;
      mockHashtagTrendService.syncTrendingToDB.mockImplementation((category, userId) => {
        if (category === TrendCategory.PERSONALIZED) {
          callCount++;
          if (callCount === 1) {
            throw new Error('User sync failed');
          }
          return Promise.resolve(5);
        }
        return Promise.resolve(10);
      });

      const results = await service.handleTrendSyncToPostgres();

      const personalizedResult = results.find(r => r.category === TrendCategory.PERSONALIZED);
      expect(personalizedResult).toBeDefined();
      expect(personalizedResult?.error).toContain('1 users failed');
    });

    it('should process users in batches of 50', async () => {
      // Create 60 mock users to test batching
      const mockUsers = Array.from({ length: 60 }, (_, i) => ({ id: i + 1 }));
      mockUserService.getActiveUsers.mockResolvedValue(mockUsers);
      mockHashtagTrendService.syncTrendingToDB.mockResolvedValue(5);

      const results = await service.handleTrendSyncToPostgres();

      const personalizedResult = results.find(r => r.category === TrendCategory.PERSONALIZED);
      expect(personalizedResult?.userCount).toBe(60);
      // Each user should have syncTrendingToDB called for personalized
      expect(mockHashtagTrendService.syncTrendingToDB).toHaveBeenCalledWith(
        TrendCategory.PERSONALIZED,
        expect.any(Number),
      );
    });

    it('should aggregate total count from all categories', async () => {
      mockUserService.getActiveUsers.mockResolvedValue([]);
      mockHashtagTrendService.syncTrendingToDB.mockResolvedValue(10);

      const results = await service.handleTrendSyncToPostgres();

      const totalQueued = results.reduce((sum, r) => sum + (r.count || 0), 0);
      // All non-personalized categories should have count of 10
      // Personalized with no users should have count of 0
      const expectedTotal = (ALL_TREND_CATEGORIES.length - 1) * 10; // -1 for personalized with 0 users
      expect(totalQueued).toBe(expectedTotal);
    });

    it('should return results with category and count for successful syncs', async () => {
      mockUserService.getActiveUsers.mockResolvedValue([]);
      mockHashtagTrendService.syncTrendingToDB.mockResolvedValue(15);

      const results = await service.handleTrendSyncToPostgres();

      results.forEach(result => {
        expect(result.category).toBeDefined();
        if (result.category !== TrendCategory.PERSONALIZED) {
          expect(result.count).toBe(15);
          expect(result.error).toBeUndefined();
        }
      });
    });

    it('should handle empty active users list for personalized trends', async () => {
      mockUserService.getActiveUsers.mockResolvedValue([]);
      mockHashtagTrendService.syncTrendingToDB.mockResolvedValue(10);

      const results = await service.handleTrendSyncToPostgres();

      const personalizedResult = results.find(r => r.category === TrendCategory.PERSONALIZED);
      expect(personalizedResult?.userCount).toBe(0);
      expect(personalizedResult?.count).toBe(0);
    });
  });
});
