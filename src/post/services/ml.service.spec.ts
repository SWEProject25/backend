import { Test, TestingModule } from '@nestjs/testing';
import { MLService } from './ml.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

describe('MLService', () => {
  let service: MLService;
  let httpService: any;
  let configService: any;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://test-ml-service:8001/predict'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MLService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MLService>(MLService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQualityScores', () => {
    const mockPosts = [
      {
        postId: 1,
        contentLength: 100,
        hasMedia: true,
        hashtagCount: 2,
        mentionCount: 1,
        author: {
          authorId: 1,
          authorFollowersCount: 1000,
          authorFollowingCount: 500,
          authorTweetCount: 200,
          authorIsVerified: true,
        },
      },
      {
        postId: 2,
        contentLength: 50,
        hasMedia: false,
        hashtagCount: 0,
        mentionCount: 0,
        author: {
          authorId: 2,
          authorFollowersCount: 100,
          authorFollowingCount: 50,
          authorTweetCount: 20,
          authorIsVerified: false,
        },
      },
    ];

    it('should return empty map when posts array is empty', async () => {
      const result = await service.getQualityScores([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should return quality scores from ML service', async () => {
      const mockResponse = {
        data: {
          rankedPosts: [
            { postId: 1, qualityScore: 0.85 },
            { postId: 2, qualityScore: 0.65 },
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.getQualityScores(mockPosts);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://test-ml-service:8001/predict',
        { posts: mockPosts },
        { timeout: 5000 },
      );
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get(1)).toBe(0.85);
      expect(result.get(2)).toBe(0.65);
    });

    it('should return empty map when ML service fails', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.getQualityScores(mockPosts);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle timeout errors gracefully', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('timeout of 5000ms exceeded')));

      const result = await service.getQualityScores(mockPosts);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('constructor', () => {
    it('should use default URL when config is not set', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MLService,
          {
            provide: HttpService,
            useValue: { post: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const mlService = module.get<MLService>(MLService);
      expect(mlService).toBeDefined();
    });
  });
});
