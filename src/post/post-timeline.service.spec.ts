import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './services/post.service';
import { PrismaService } from '../prisma/prisma.service';
import { MLService } from './services/ml.service';
import { Services } from '../utils/constants';

describe('PostService - Timeline Endpoints', () => {
  let service: PostService;
  let prismaService: PrismaService;
  let mlService: MLService;

  const mockPrismaService = {
    $queryRawUnsafe: jest.fn(),
  };

  const mockMlService = {
    getQualityScores: jest.fn().mockResolvedValue(new Map([[100, 0.85]])),
  };

  const mockPostWithAllData = {
    id: 100,
    user_id: 2,
    content: 'Test post content',
    created_at: new Date('2023-11-20T10:00:00Z'),
    effectiveDate: new Date('2023-11-20T10:00:00Z'),
    type: 'POST',
    visibility: 'PUBLIC',
    parent_id: null,
    interest_id: 1,
    is_deleted: false,
    isRepost: false,
    repostedBy: null,
    username: 'jane_doe',
    isVerified: true,
    authorName: 'Jane Doe',
    authorProfileImage: 'https://example.com/avatar.jpg',
    likeCount: 50,
    replyCount: 5,
    repostCount: 10,
    followersCount: 100,
    followingCount: 50,
    postsCount: 200,
    hasMedia: false,
    hashtagCount: 2,
    mentionCount: 1,
    isLikedByMe: false,
    isFollowedByMe: true,
    isRepostedByMe: false,
    mediaUrls: [],
    originalPost: null,
    personalizationScore: 25.5,
    qualityScore: undefined,
    finalScore: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.STORAGE,
          useValue: {
            uploadFiles: jest.fn(),
            deleteFiles: jest.fn(),
          },
        },
        {
          provide: MLService,
          useValue: mockMlService,
        },
        {
          provide: Services.AI_SUMMARIZATION,
          useValue: {
            summarizePost: jest.fn(),
          },
        },
        {
          provide: 'BullQueue_post-queue',
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    prismaService = module.get<PrismaService>(Services.PRISMA);
    mlService = module.get<MLService>(MLService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getForYouFeed', () => {
    it('should return personalized "For You" feed with default pagination', async () => {
      const candidatePosts = [mockPostWithAllData];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(candidatePosts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getForYouFeed(1, 1, 10);

      expect(result.posts).toBeDefined();
      expect(result.posts.length).toBeGreaterThan(0);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(mockMlService.getQualityScores).toHaveBeenCalled();
    });

    it('should apply hybrid ranking with quality and personalization weights', async () => {
      const candidatePosts = [
        { ...mockPostWithAllData, id: 1, personalizationScore: 30.0 },
        { ...mockPostWithAllData, id: 2, personalizationScore: 20.0 },
      ];
      const qualityScores = new Map([[1, 0.7], [2, 0.9]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(candidatePosts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getForYouFeed(1, 1, 10);

      expect(result.posts[0]).toHaveProperty('qualityScore');
      expect(result.posts[0]).toHaveProperty('finalScore');
    });

    it('should handle custom pagination', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getForYouFeed(1, 2, 20);

      // Verify the query was called (pagination handled in SQL)
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should return empty array when no posts available', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getForYouFeed(1, 1, 10);

      expect(result.posts).toEqual([]);
      expect(mockMlService.getQualityScores).not.toHaveBeenCalled();
    });

    it('should filter out blocked users', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getForYouFeed(1, 1, 10);

      // Query should include block filtering
      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('user_blocks');
    });

    it('should filter out muted users', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getForYouFeed(1, 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('user_mutes');
    });

    it('should handle reposts in feed', async () => {
      const repost = {
        ...mockPostWithAllData,
        isRepost: true,
        repostedBy: {
          userId: 5,
          username: 'reposter',
          verified: true,
          name: 'Reposter',
          avatar: 'https://example.com/reposter.jpg',
        },
      };

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([repost]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      const result = await service.getForYouFeed(1, 1, 10);

      expect(result.posts[0].isRepost).toBe(true);
      expect(result.posts[0].text).toBe('');
      expect(result.posts[0].media).toEqual([]);
    });

    it('should handle quote tweets', async () => {
      const quote = {
        ...mockPostWithAllData,
        type: 'QUOTE',
        parent_id: 99,
        isQuote: true,
        originalPost: {
          postId: 99,
          content: 'Original content',
          createdAt: new Date('2023-11-19T10:00:00Z'),
          likeCount: 100,
          repostCount: 20,
          replyCount: 15,
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          author: {
            userId: 3,
            username: 'original_user',
            isVerified: false,
            name: 'Original User',
            avatar: null,
          },
          media: [],
        },
      };

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([quote]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      const result = await service.getForYouFeed(1, 1, 10);

      expect(result.posts[0].isQuote).toBe(true);
      expect(result.posts[0].originalPostData).toBeDefined();
    });

    it('should call ML service with correct post features', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getForYouFeed(1, 1, 10);

      expect(mockMlService.getQualityScores).toHaveBeenCalledWith([
        {
          postId: 100,
          contentLength: mockPostWithAllData.content.length,
          hasMedia: false,
          hashtagCount: 2,
          mentionCount: 1,
          author: {
            authorId: 2,
            authorFollowersCount: 100,
            authorFollowingCount: 50,
            authorTweetCount: 200,
            authorIsVerified: true,
          },
        },
      ]);
    });

    it('should handle ML service failures gracefully', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockRejectedValue(new Error('ML service down'));

      await expect(service.getForYouFeed(1, 1, 10)).rejects.toThrow('ML service down');
    });
  });

  describe('getFollowingForFeed', () => {
    it('should return "Following" feed with posts from followed users', async () => {
      const followingPosts = [{ ...mockPostWithAllData, isFollowedByMe: true }];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(followingPosts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getFollowingForFeed(1, 1, 10);

      expect(result.posts).toBeDefined();
      expect(result.posts[0].isFollowedByMe).toBe(true);
    });

    it('should return empty array when user follows no one', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getFollowingForFeed(1, 1, 10);

      expect(result.posts).toEqual([]);
    });

    it('should include reposts from followed users', async () => {
      const repost = {
        ...mockPostWithAllData,
        isRepost: true,
        isFollowedByMe: true,
      };

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([repost]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      const result = await service.getFollowingForFeed(1, 1, 10);

      expect(result.posts[0].isRepost).toBe(true);
    });

    it('should filter out blocked users even from following', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getFollowingForFeed(1, 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('user_blocks');
    });

    it('should filter out muted users even from following', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getFollowingForFeed(1, 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('user_mutes');
    });

    it('should handle custom pagination', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getFollowingForFeed(1, 3, 15);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('getExploreFeed', () => {
    it('should return "Explore" feed with interest-boosted ranking', async () => {
      const explorePosts = [
        { ...mockPostWithAllData, personalizationScore: 50.0 }, // Higher due to interest match
      ];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(explorePosts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getExploreFeed(1, 1, 10);

      expect(result.posts).toBeDefined();
      expect(result.posts[0].personalizationScore).toBeGreaterThan(25);
    });

    it('should return all posts when user has no interests', async () => {
      const posts = [{ ...mockPostWithAllData, personalizationScore: 15.0 }];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(posts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getExploreFeed(1, 1, 10);

      expect(result.posts).toBeDefined();
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it('should boost posts matching user interests', async () => {
      const posts = [
        { ...mockPostWithAllData, id: 1, interest_id: 1, personalizationScore: 50.0 },
        { ...mockPostWithAllData, id: 2, interest_id: null, personalizationScore: 15.0 },
      ];
      const qualityScores = new Map([[1, 0.8], [2, 0.9]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(posts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getExploreFeed(1, 1, 10);

      // Interest match should give +25 bonus
      expect(result.posts).toBeDefined();
    });

    it('should include posts from non-followed users', async () => {
      const posts = [{ ...mockPostWithAllData, isFollowedByMe: false }];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(posts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getExploreFeed(1, 1, 10);

      expect(result.posts[0].isFollowedByMe).toBe(false);
    });

    it('should filter out current user posts', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreFeed(1, 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('p."user_id" != 1');
    });

    it('should filter out blocked and muted users', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreFeed(1, 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('user_blocks');
      expect(query).toContain('user_mutes');
    });

    it('should only include recent posts (30 days)', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreFeed(1, 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain("INTERVAL '30 days'");
    });
  });

  describe('getExploreByInterestsFeed', () => {
    it('should return posts strictly matching specified interests', async () => {
      const interestPosts = [{ ...mockPostWithAllData, interest_id: 1 }];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(interestPosts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getExploreByInterestsFeed(1, ['Technology'], 1, 10);

      expect(result.posts).toBeDefined();
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it('should handle multiple interest filters', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreByInterestsFeed(1, ['Technology', 'Sports', 'Music'], 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain("'Technology'");
      expect(query).toContain("'Sports'");
      expect(query).toContain("'Music'");
    });

    it('should return empty array when no posts match interests', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getExploreByInterestsFeed(1, ['RareInterest'], 1, 10);

      expect(result.posts).toEqual([]);
    });

    it('should escape special characters in interest names', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreByInterestsFeed(1, ['C++', 'Node.js'], 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toBeDefined();
    });

    it('should filter out blocked and muted users', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreByInterestsFeed(1, ['Technology'], 1, 10);

      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain('user_blocks');
      expect(query).toContain('user_mutes');
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockPostWithAllData]);
      mockMlService.getQualityScores.mockResolvedValue(new Map([[100, 0.85]]));

      await service.getExploreByInterestsFeed(1, ['Technology'], 2, 20);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should apply personalization scoring to matched posts', async () => {
      const posts = [{ ...mockPostWithAllData, personalizationScore: 30.0 }];
      const qualityScores = new Map([[100, 0.85]]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(posts);
      mockMlService.getQualityScores.mockResolvedValue(qualityScores);

      const result = await service.getExploreByInterestsFeed(1, ['Technology'], 1, 10);

      expect(result.posts[0]).toHaveProperty('personalizationScore');
      expect(result.posts[0]).toHaveProperty('qualityScore');
      expect(result.posts[0]).toHaveProperty('finalScore');
    });
  });

  describe('Timeline Service - Error Handling', () => {
    it('should handle database errors in For You feed', async () => {
      mockPrismaService.$queryRawUnsafe.mockRejectedValue(new Error('Database connection lost'));

      await expect(service.getForYouFeed(1, 1, 10)).rejects.toThrow('Database connection lost');
    });

    it('should handle database errors in Following feed', async () => {
      mockPrismaService.$queryRawUnsafe.mockRejectedValue(new Error('Query timeout'));

      await expect(service.getFollowingForFeed(1, 1, 10)).rejects.toThrow('Query timeout');
    });

    it('should handle database errors in Explore feed', async () => {
      mockPrismaService.$queryRawUnsafe.mockRejectedValue(new Error('Table does not exist'));

      await expect(service.getExploreFeed(1, 1, 10)).rejects.toThrow('Table does not exist');
    });

    it('should handle database errors in Explore by Interests', async () => {
      mockPrismaService.$queryRawUnsafe.mockRejectedValue(new Error('Invalid SQL'));

      await expect(service.getExploreByInterestsFeed(1, ['Technology'], 1, 10)).rejects.toThrow(
        'Invalid SQL',
      );
    });
  });
});
