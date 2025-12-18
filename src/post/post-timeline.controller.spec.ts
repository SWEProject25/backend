import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './services/post.service';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { Services } from 'src/utils/constants';

describe('PostController - Timeline Endpoints', () => {
  let controller: PostController;
  let service: PostService;

  const mockPostService = {
    getForYouFeed: jest.fn(),
    getFollowingForFeed: jest.fn(),
    getExploreByInterestsFeed: jest.fn(),
    getExploreAllInterestsFeed: jest.fn(),
  };

  const mockUser: AuthenticatedUser = {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    is_verified: true,
    provider_id: null,
    role: Role.USER,
    has_completed_interests: true,
    has_completed_following: true,
    created_at: new Date('2023-01-01T00:00:00Z'),
    updated_at: new Date('2023-01-01T00:00:00Z'),
  };

  // Helper function to create mock users
  const createMockUser = (id: number, username: string): AuthenticatedUser => ({
    id,
    username,
    email: `${username}@example.com`,
    is_verified: false,
    provider_id: null,
    role: Role.USER,
    has_completed_interests: true,
    has_completed_following: true,
    created_at: new Date('2023-01-01T00:00:00Z'),
    updated_at: new Date('2023-01-01T00:00:00Z'),
  });

  const mockFeedPost = {
    userId: 2,
    username: 'jane_doe',
    verified: true,
    name: 'Jane Doe',
    avatar: 'https://example.com/avatar.jpg',
    postId: 100,
    date: new Date('2023-11-20T10:00:00Z'),
    likesCount: 50,
    retweetsCount: 10,
    commentsCount: 5,
    isLikedByMe: false,
    isFollowedByMe: true,
    isRepostedByMe: false,
    text: 'This is a test post',
    media: [
      {
        url: 'https://example.com/media.jpg',
        type: 'IMAGE',
      },
    ],
    isRepost: false,
    isQuote: false,
    originalPostData: null,
    personalizationScore: 25.5,
    qualityScore: 0.85,
    finalScore: 20.125,
  };

  const mockFeedResponse = {
    posts: [mockFeedPost],
  };

  const mockLikeService = {
    togglePostLike: jest.fn(),
    getListOfLikers: jest.fn(),
    getLikedPostsByUser: jest.fn(),
  };

  const mockRepostService = {
    toggleRepost: jest.fn(),
    getReposters: jest.fn(),
  };

  const mockMentionService = {
    mentionUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: Services.POST,
          useValue: mockPostService,
        },
        {
          provide: Services.LIKE,
          useValue: mockLikeService,
        },
        {
          provide: Services.REPOST,
          useValue: mockRepostService,
        },
        {
          provide: Services.MENTION,
          useValue: mockMentionService,
        },
      ],
    }).compile();

    controller = module.get<PostController>(PostController);
    service = module.get<PostService>(Services.POST);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getForYouFeed', () => {
    it('should return "For You" feed with default pagination', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);

      const result = await controller.getForYouFeed(1, 10, mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Posts retrieved successfully');
      expect(result.data).toEqual(mockFeedResponse);
      expect(mockPostService.getForYouFeed).toHaveBeenCalledWith(1, 1, 10);
    });

    it('should handle custom pagination parameters', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);

      const result = await controller.getForYouFeed(2, 20, mockUser);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockFeedResponse);
      expect(mockPostService.getForYouFeed).toHaveBeenCalledWith(1, 2, 20);
    });

    it('should return empty posts array when no posts available', async () => {
      const emptyResponse = { posts: [] };
      mockPostService.getForYouFeed.mockResolvedValue(emptyResponse);

      const result = await controller.getForYouFeed(1, 10, mockUser);

      expect(result.status).toBe('success');
      expect(result.data.posts).toHaveLength(0);
    });

    it('should return posts with personalization scores', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);

      const result = await controller.getForYouFeed(1, 10, mockUser);

      expect(result.data.posts[0]).toHaveProperty('personalizationScore');
      expect(result.data.posts[0]).toHaveProperty('qualityScore');
      expect(result.data.posts[0]).toHaveProperty('finalScore');
    });

    it('should handle posts with media attachments', async () => {
      const postWithMedia = {
        ...mockFeedPost,
        media: [
          { url: 'https://example.com/image1.jpg', type: 'IMAGE' },
          { url: 'https://example.com/image2.jpg', type: 'IMAGE' },
        ],
      };
      mockPostService.getForYouFeed.mockResolvedValue({ posts: [postWithMedia] });

      const result = await controller.getForYouFeed(1, 10, mockUser);

      expect(result.data.posts[0].media).toHaveLength(2);
    });

    it('should handle reposted posts', async () => {
      const repost = {
        ...mockFeedPost,
        isRepost: true,
        text: '',
        media: [],
        originalPostData: {
          userId: 3,
          username: 'original_user',
          verified: false,
          name: 'Original User',
          avatar: null,
          postId: 99,
          date: new Date('2023-11-19T10:00:00Z'),
          likesCount: 100,
          retweetsCount: 20,
          commentsCount: 15,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          text: 'Original post content',
          media: [],
        },
      };
      mockPostService.getForYouFeed.mockResolvedValue({ posts: [repost] });

      const result = await controller.getForYouFeed(1, 10, mockUser);

      expect(result.data.posts[0].isRepost).toBe(true);
      expect(result.data.posts[0].originalPostData).toBeDefined();
      expect(result?.data?.posts[0]?.originalPostData?.postId).toBe(99);
    });

    it('should handle quote tweets', async () => {
      const quote = {
        ...mockFeedPost,
        isQuote: true,
        text: 'Quoting this amazing post!',
        originalPostData: {
          userId: 3,
          username: 'quoted_user',
          verified: true,
          name: 'Quoted User',
          avatar: 'https://example.com/quoted-avatar.jpg',
          postId: 98,
          date: new Date('2023-11-18T10:00:00Z'),
          likesCount: 200,
          retweetsCount: 50,
          commentsCount: 30,
          isLikedByMe: false,
          isFollowedByMe: true,
          isRepostedByMe: false,
          text: 'Original quoted content',
          media: [],
        },
      };
      mockPostService.getForYouFeed.mockResolvedValue({ posts: [quote] });

      const result = await controller.getForYouFeed(1, 10, mockUser);

      expect(result.data.posts[0].isQuote).toBe(true);
      expect(result.data.posts[0].text).toBe('Quoting this amazing post!');
      expect(result.data.posts[0].originalPostData).toBeDefined();
    });

    it('should pass authenticated user ID to service', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);
      const differentUser = createMockUser(5, 'different_user');

      await controller.getForYouFeed(1, 10, differentUser);

      expect(mockPostService.getForYouFeed).toHaveBeenCalledWith(5, 1, 10);
    });
  });

  describe('getUserTimeline', () => {
    it('should return "Following" feed with default pagination', async () => {
      mockPostService.getFollowingForFeed.mockResolvedValue(mockFeedResponse);

      const result = await controller.getUserTimeline(1, 10, mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Posts retrieved successfully');
      expect(result.data).toEqual(mockFeedResponse);
      expect(mockPostService.getFollowingForFeed).toHaveBeenCalledWith(1, 1, 10);
    });

    it('should handle custom pagination for following feed', async () => {
      mockPostService.getFollowingForFeed.mockResolvedValue(mockFeedResponse);

      await controller.getUserTimeline(3, 15, mockUser);

      expect(mockPostService.getFollowingForFeed).toHaveBeenCalledWith(1, 3, 15);
    });

    it('should return empty array when user follows no one', async () => {
      mockPostService.getFollowingForFeed.mockResolvedValue({ posts: [] });

      const result = await controller.getUserTimeline(1, 10, mockUser);

      expect(result.data.posts).toHaveLength(0);
    });

    it('should return posts only from followed users', async () => {
      const followedPost = {
        ...mockFeedPost,
        isFollowedByMe: true,
      };
      mockPostService.getFollowingForFeed.mockResolvedValue({ posts: [followedPost] });

      const result = await controller.getUserTimeline(1, 10, mockUser);

      expect(result.data.posts[0].isFollowedByMe).toBe(true);
    });

    it('should handle reposts from followed users', async () => {
      const repostFromFollowed = {
        ...mockFeedPost,
        isRepost: true,
        isFollowedByMe: true,
        originalPostData: {
          userId: 10,
          username: 'someone_else',
          verified: false,
          name: 'Someone Else',
          avatar: null,
          postId: 200,
          date: new Date('2023-11-15T10:00:00Z'),
          likesCount: 50,
          retweetsCount: 5,
          commentsCount: 2,
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          text: 'Content from unfollowed user',
          media: [],
        },
      };
      mockPostService.getFollowingForFeed.mockResolvedValue({ posts: [repostFromFollowed] });

      const result = await controller.getUserTimeline(1, 10, mockUser);

      expect(result.data.posts[0].isRepost).toBe(true);
      expect(result?.data?.posts[0]?.originalPostData?.isFollowedByMe).toBe(false);
    });

    it('should pass correct user ID to service', async () => {
      mockPostService.getFollowingForFeed.mockResolvedValue(mockFeedResponse);
      const anotherUser = createMockUser(10, 'another_user');

      await controller.getUserTimeline(1, 10, anotherUser);

      expect(mockPostService.getFollowingForFeed).toHaveBeenCalledWith(10, 1, 10);
    });
  });

  describe('getExploreByInterestsFeed', () => {
    it('should return posts filtered by single interest with default sortBy', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      const result = await controller.getExploreByInterestsFeed(
        ['Technology'],
        1,
        10,
        'score',
        mockUser,
      );

      expect(result.status).toBe('success');
      expect(result.message).toBe('Interest-filtered posts retrieved successfully');
      expect(result.data).toEqual(mockFeedResponse);
      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(1, ['Technology'], {
        page: 1,
        limit: 10,
        sortBy: 'score',
      });
    });

    it('should return posts filtered by multiple interests', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      await controller.getExploreByInterestsFeed(
        ['Technology', 'Sports', 'Music'],
        1,
        10,
        'score',
        mockUser,
      );

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(
        1,
        ['Technology', 'Sports', 'Music'],
        { page: 1, limit: 10, sortBy: 'score' },
      );
    });

    it('should handle sortBy latest parameter', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      await controller.getExploreByInterestsFeed(['Technology'], 1, 10, 'latest', mockUser);

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(1, ['Technology'], {
        page: 1,
        limit: 10,
        sortBy: 'latest',
      });
    });

    it('should default sortBy to score when not provided', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      await controller.getExploreByInterestsFeed(['Technology'], 1, 10, undefined as any, mockUser);

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(1, ['Technology'], {
        page: 1,
        limit: 10,
        sortBy: 'score',
      });
    });

    it('should throw BadRequestException when interests array is empty', async () => {
      await expect(
        controller.getExploreByInterestsFeed([], 1, 10, 'score', mockUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getExploreByInterestsFeed([], 1, 10, 'score', mockUser),
      ).rejects.toThrow('At least one interest is required');
    });

    it('should throw BadRequestException when interests is not an array', async () => {
      await expect(
        controller.getExploreByInterestsFeed(null as any, 1, 10, 'score', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle custom pagination', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      await controller.getExploreByInterestsFeed(['Technology'], 2, 15, 'score', mockUser);

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(1, ['Technology'], {
        page: 2,
        limit: 15,
        sortBy: 'score',
      });
    });

    it('should return empty array when no posts match interests', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue({ posts: [] });

      const result = await controller.getExploreByInterestsFeed(
        ['RareInterest'],
        1,
        10,
        'score',
        mockUser,
      );

      expect(result.data.posts).toHaveLength(0);
    });

    it('should handle case-sensitive interest names', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      await controller.getExploreByInterestsFeed(
        ['technology', 'SPORTS'],
        1,
        10,
        'score',
        mockUser,
      );

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(
        1,
        ['technology', 'SPORTS'],
        { page: 1, limit: 10, sortBy: 'score' },
      );
    });

    it('should pass authenticated user ID correctly', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);
      const anotherUser = createMockUser(7, 'another_user');

      await controller.getExploreByInterestsFeed(['Technology'], 1, 10, 'score', anotherUser);

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(7, ['Technology'], {
        page: 1,
        limit: 10,
        sortBy: 'score',
      });
    });

    it('should handle special characters in interest names', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      await controller.getExploreByInterestsFeed(
        ['C++', 'Node.js', "Rock 'n' Roll"],
        1,
        10,
        'score',
        mockUser,
      );

      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(
        1,
        ['C++', 'Node.js', "Rock 'n' Roll"],
        { page: 1, limit: 10, sortBy: 'score' },
      );
    });

    it('should return posts with personalization scores when sortBy is score', async () => {
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(mockFeedResponse);

      const result = await controller.getExploreByInterestsFeed(
        ['Technology'],
        1,
        10,
        'score',
        mockUser,
      );

      expect(result.data.posts[0]).toHaveProperty('personalizationScore');
      expect(result.data.posts[0]).toHaveProperty('qualityScore');
      expect(result.data.posts[0]).toHaveProperty('finalScore');
    });

    it('should return posts sorted by date when sortBy is latest', async () => {
      const latestPosts = {
        posts: [
          { ...mockFeedPost, postId: 1, date: new Date('2023-11-22T10:00:00Z') },
          { ...mockFeedPost, postId: 2, date: new Date('2023-11-21T10:00:00Z') },
        ],
      };
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(latestPosts);

      const result = await controller.getExploreByInterestsFeed(
        ['Technology'],
        1,
        10,
        'latest',
        mockUser,
      );

      expect(result.data.posts).toHaveLength(2);
      expect(new Date(result.data.posts[0].date).getTime()).toBeGreaterThanOrEqual(
        new Date(result.data.posts[1].date).getTime(),
      );
    });

    it('should only return posts strictly matching provided interests', async () => {
      const techPosts = {
        posts: [
          { ...mockFeedPost, postId: 1, text: 'Tech post 1' },
          { ...mockFeedPost, postId: 2, text: 'Tech post 2' },
        ],
      };
      mockPostService.getExploreByInterestsFeed.mockResolvedValue(techPosts);

      const result = await controller.getExploreByInterestsFeed(
        ['Technology'],
        1,
        10,
        'score',
        mockUser,
      );

      expect(result.data.posts).toHaveLength(2);
      expect(mockPostService.getExploreByInterestsFeed).toHaveBeenCalledWith(1, ['Technology'], {
        page: 1,
        limit: 10,
        sortBy: 'score',
      });
    });
  });

  describe('getExploreForYouFeed', () => {
    const mockExploreAllInterestsResponse = {
      Technology: [
        { ...mockFeedPost, postId: 1, text: 'Tech post 1' },
        { ...mockFeedPost, postId: 2, text: 'Tech post 2' },
        { ...mockFeedPost, postId: 3, text: 'Tech post 3' },
        { ...mockFeedPost, postId: 4, text: 'Tech post 4' },
        { ...mockFeedPost, postId: 5, text: 'Tech post 5' },
      ],
      Sports: [
        { ...mockFeedPost, postId: 6, text: 'Sports post 1' },
        { ...mockFeedPost, postId: 7, text: 'Sports post 2' },
      ],
      Music: [
        { ...mockFeedPost, postId: 8, text: 'Music post 1' },
        { ...mockFeedPost, postId: 9, text: 'Music post 2' },
        { ...mockFeedPost, postId: 10, text: 'Music post 3' },
      ],
    };

    it('should return posts grouped by all active interests with default parameters', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Posts retrieved successfully');
      expect(result.data).toEqual(mockExploreAllInterestsResponse);
      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(1, {
        sortBy: 'score',
        postsPerInterest: 5,
      });
    });

    it('should handle sortBy latest parameter', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('latest', 5, mockUser);

      expect(result.status).toBe('success');
      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(1, {
        sortBy: 'latest',
        postsPerInterest: 5,
      });
    });

    it('should handle custom postsPerInterest parameter', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('score', 10, mockUser);

      expect(result.status).toBe('success');
      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(1, {
        sortBy: 'score',
        postsPerInterest: 10,
      });
    });

    it('should default to score and 5 posts when parameters not provided', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed(
        undefined as any,
        undefined as any,
        mockUser,
      );

      expect(result.status).toBe('success');
      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(1, {
        sortBy: 'score',
        postsPerInterest: 5,
      });
    });

    it('should return top 5 posts per interest by default', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology).toHaveLength(5);
      expect(result.data.Sports).toHaveLength(2);
      expect(result.data.Music).toHaveLength(3);
    });

    it('should return posts from multiple interests', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(Object.keys(result.data)).toContain('Technology');
      expect(Object.keys(result.data)).toContain('Sports');
      expect(Object.keys(result.data)).toContain('Music');
      expect(Object.keys(result.data)).toHaveLength(3);
    });

    it('should return empty object when no posts available', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue({});

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.status).toBe('success');
      expect(result.data).toEqual({});
      expect(Object.keys(result.data)).toHaveLength(0);
    });

    it('should pass authenticated user ID to service', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);
      const differentUser = createMockUser(5, 'different_user');

      await controller.getExploreForYouFeed('score', 5, differentUser);

      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(5, {
        sortBy: 'score',
        postsPerInterest: 5,
      });
    });

    it('should handle interest with less than 5 posts', async () => {
      const sparseResponse = {
        Technology: [
          { ...mockFeedPost, postId: 1, text: 'Tech post 1' },
          { ...mockFeedPost, postId: 2, text: 'Tech post 2' },
        ],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(sparseResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology).toHaveLength(2);
    });

    it('should handle interest with exactly 5 posts', async () => {
      const exactResponse = {
        Technology: Array.from({ length: 5 }, (_, i) => ({
          ...mockFeedPost,
          postId: i + 1,
          text: `Tech post ${i + 1}`,
        })),
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(exactResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology).toHaveLength(5);
    });

    it('should handle single interest', async () => {
      const singleInterestResponse = {
        Technology: [
          { ...mockFeedPost, postId: 1, text: 'Tech post 1' },
          { ...mockFeedPost, postId: 2, text: 'Tech post 2' },
          { ...mockFeedPost, postId: 3, text: 'Tech post 3' },
        ],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(singleInterestResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(Object.keys(result.data)).toHaveLength(1);
      expect(result.data.Technology).toBeDefined();
      expect(result.data.Technology).toHaveLength(3);
    });

    it('should include posts with personalization scores', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology[0]).toHaveProperty('personalizationScore');
      expect(result.data.Technology[0]).toHaveProperty('qualityScore');
      expect(result.data.Technology[0]).toHaveProperty('finalScore');
    });

    it('should handle reposts in explore feed', async () => {
      const withRepost = {
        Technology: [
          {
            ...mockFeedPost,
            postId: 1,
            isRepost: true,
            text: '',
            media: [],
            originalPostData: {
              userId: 10,
              username: 'original_user',
              verified: false,
              name: 'Original User',
              avatar: null,
              postId: 99,
              date: new Date('2023-11-15T10:00:00Z'),
              likesCount: 100,
              retweetsCount: 20,
              commentsCount: 10,
              isLikedByMe: false,
              isFollowedByMe: false,
              isRepostedByMe: false,
              text: 'Original content',
              media: [],
            },
          },
        ],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(withRepost);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology[0].isRepost).toBe(true);
      expect(result.data.Technology[0].originalPostData).toBeDefined();
    });

    it('should handle quote tweets in explore feed', async () => {
      const withQuote = {
        Technology: [
          {
            ...mockFeedPost,
            postId: 1,
            isQuote: true,
            text: 'Great insight!',
            originalPostData: {
              userId: 10,
              username: 'quoted_user',
              verified: true,
              name: 'Quoted User',
              avatar: 'https://example.com/avatar.jpg',
              postId: 98,
              date: new Date('2023-11-15T10:00:00Z'),
              likesCount: 150,
              retweetsCount: 30,
              commentsCount: 20,
              isLikedByMe: false,
              isFollowedByMe: true,
              isRepostedByMe: false,
              text: 'Quoted content',
              media: [],
            },
          },
        ],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(withQuote);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology[0].isQuote).toBe(true);
      expect(result.data.Technology[0].text).toBe('Great insight!');
      expect(result.data.Technology[0].originalPostData).toBeDefined();
    });

    it('should handle posts with media in explore feed', async () => {
      const withMedia = {
        Technology: [
          {
            ...mockFeedPost,
            postId: 1,
            media: [
              { url: 'https://example.com/image1.jpg', type: 'IMAGE' },
              { url: 'https://example.com/video1.mp4', type: 'VIDEO' },
            ],
          },
        ],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(withMedia);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data.Technology[0].media).toHaveLength(2);
      expect(result.data.Technology[0].media[0].type).toBe('IMAGE');
      expect(result.data.Technology[0].media[1].type).toBe('VIDEO');
    });

    it('should handle many interests', async () => {
      const manyInterests = {
        Technology: [{ ...mockFeedPost, postId: 1 }],
        Sports: [{ ...mockFeedPost, postId: 2 }],
        Music: [{ ...mockFeedPost, postId: 3 }],
        Travel: [{ ...mockFeedPost, postId: 4 }],
        Food: [{ ...mockFeedPost, postId: 5 }],
        Fashion: [{ ...mockFeedPost, postId: 6 }],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(manyInterests);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(Object.keys(result.data)).toHaveLength(6);
    });

    it('should preserve interest names as keys', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      const result = await controller.getExploreForYouFeed('score', 5, mockUser);

      expect(result.data).toHaveProperty('Technology');
      expect(result.data).toHaveProperty('Sports');
      expect(result.data).toHaveProperty('Music');
    });

    it('should handle service errors', async () => {
      mockPostService.getExploreAllInterestsFeed.mockRejectedValue(new Error('Service error'));

      await expect(controller.getExploreForYouFeed('score', 5, mockUser)).rejects.toThrow(
        'Service error',
      );
    });

    it('should return different results for different users', async () => {
      const user1Response = {
        Technology: [{ ...mockFeedPost, postId: 1 }],
      };
      const user2Response = {
        Sports: [{ ...mockFeedPost, postId: 2 }],
      };

      mockPostService.getExploreAllInterestsFeed.mockResolvedValueOnce(user1Response);
      const result1 = await controller.getExploreForYouFeed('score', 5, mockUser);

      mockPostService.getExploreAllInterestsFeed.mockResolvedValueOnce(user2Response);
      const differentUser = createMockUser(2, 'different_user');
      const result2 = await controller.getExploreForYouFeed('score', 5, differentUser);

      expect(result1.data).toHaveProperty('Technology');
      expect(result1.data).not.toHaveProperty('Sports');
      expect(result2.data).toHaveProperty('Sports');
      expect(result2.data).not.toHaveProperty('Technology');
    });

    it('should handle postsPerInterest of 1', async () => {
      const response = {
        Technology: [{ ...mockFeedPost, postId: 1 }],
      };
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(response);

      const result = await controller.getExploreForYouFeed('score', 1, mockUser);

      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(1, {
        sortBy: 'score',
        postsPerInterest: 1,
      });
      expect(result.data.Technology).toHaveLength(1);
    });

    it('should handle large postsPerInterest values', async () => {
      mockPostService.getExploreAllInterestsFeed.mockResolvedValue(mockExploreAllInterestsResponse);

      await controller.getExploreForYouFeed('score', 100, mockUser);

      expect(mockPostService.getExploreAllInterestsFeed).toHaveBeenCalledWith(1, {
        sortBy: 'score',
        postsPerInterest: 100,
      });
    });
  });

  describe('Timeline Endpoints - Error Handling', () => {
    it('should handle service errors in For You feed', async () => {
      mockPostService.getForYouFeed.mockRejectedValue(new Error('Service error'));

      await expect(controller.getForYouFeed(1, 10, mockUser)).rejects.toThrow('Service error');
    });

    it('should handle service errors in Following feed', async () => {
      mockPostService.getFollowingForFeed.mockRejectedValue(new Error('Service error'));

      await expect(controller.getUserTimeline(1, 10, mockUser)).rejects.toThrow('Service error');
    });

    it('should handle service errors in Explore by Interests feed', async () => {
      mockPostService.getExploreByInterestsFeed.mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getExploreByInterestsFeed(['Technology'], 1, 10, 'score', mockUser),
      ).rejects.toThrow('Service error');
    });

    it('should handle database errors in Explore For You feed', async () => {
      mockPostService.getExploreAllInterestsFeed.mockRejectedValue(
        new Error('Database connection error'),
      );

      await expect(controller.getExploreForYouFeed('score', 5, mockUser)).rejects.toThrow(
        'Database connection error',
      );
    });
  });

  describe('Timeline Endpoints - Pagination Edge Cases', () => {
    it('should handle page 0 or negative page numbers', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);

      await controller.getForYouFeed(0, 10, mockUser);

      expect(mockPostService.getForYouFeed).toHaveBeenCalledWith(1, 0, 10);
    });

    it('should handle very large page numbers', async () => {
      mockPostService.getForYouFeed.mockResolvedValue({ posts: [] });

      const result = await controller.getForYouFeed(1000, 10, mockUser);

      expect(result.data.posts).toHaveLength(0);
    });

    it('should handle very large limit values', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);

      await controller.getForYouFeed(1, 1000, mockUser);

      expect(mockPostService.getForYouFeed).toHaveBeenCalledWith(1, 1, 1000);
    });

    it('should handle limit of 1', async () => {
      mockPostService.getForYouFeed.mockResolvedValue(mockFeedResponse);

      await controller.getForYouFeed(1, 1, mockUser);

      expect(mockPostService.getForYouFeed).toHaveBeenCalledWith(1, 1, 1);
    });
  });
});
