import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { getQueueToken } from '@nestjs/bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { PostType, PostVisibility } from '@prisma/client';
import { MLService } from './ml.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SocketService } from 'src/gateway/socket.service';

describe('Post Service', () => {
  let service: PostService;
  let prisma: any;
  let storageService: any;
  let postQueue: any;

  beforeEach(async () => {
    const mockMLService = {
      rankPosts: jest.fn(),
      predictQualityScore: jest.fn(),
      getQualityScores: jest.fn().mockResolvedValue({}),
    };

    const mockAiSummarizationService = {
      summarizePost: jest.fn(),
    };

    const mockHashtagTrendService = {
      queueTrendCalculation: jest.fn().mockResolvedValue(undefined),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      expire: jest.fn(),
    };

    const mockSocketService = {
      emitPostStatsUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: Services.PRISMA,
          useValue: {
            $transaction: jest.fn(),
            post: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              groupBy: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            like: {
              create: jest.fn(),
              delete: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            repost: {
              create: jest.fn(),
              delete: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            media: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: Services.STORAGE,
          useValue: {
            uploadFiles: jest.fn(),
            deleteFile: jest.fn(),
            deleteFiles: jest.fn(),
          },
        },
        {
          provide: MLService,
          useValue: mockMLService,
        },
        {
          provide: Services.AI_SUMMARIZATION,
          useValue: mockAiSummarizationService,
        },
        {
          provide: Services.HASHTAG_TRENDS,
          useValue: mockHashtagTrendService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
        {
          provide: SocketService,
          useValue: mockSocketService,
        },
        {
          provide: getQueueToken(RedisQueues.postQueue.name),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    prisma = module.get(Services.PRISMA);
    storageService = module.get(Services.STORAGE);
    postQueue = module.get(getQueueToken(RedisQueues.postQueue.name));
  });

  describe('createPost', () => {
    it('should create a post with hashtags and media', async () => {
      const mockUrls = ['https://s3/image.jpg', 'https://s3/video.mp4'];
      const mockFiles = [
        { mimetype: 'image/jpeg' },
        { mimetype: 'video/mp4' },
      ] as Express.Multer.File[];

      const createPostDto = {
        content: 'Help Me Please #horrible #mercy',
        type: PostType.POST,
        visibility: PostVisibility.EVERY_ONE,
        userId: 1,
        media: mockFiles,
      };

      const mockCreatedPost = {
        id: 1,
        content: createPostDto.content,
        type: PostType.POST,
        visibility: PostVisibility.EVERY_ONE,
        user_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        hashtags: [],
      };

      const mockRawPost = {
        ...mockCreatedPost,
        parent_id: null,
        _count: { likes: 0, repostedBy: 0 },
        quoteCount: 0,
        replyCount: 0,
        User: {
          id: 1,
          username: 'testuser',
          is_verified: false,
          Profile: { name: 'Test User', profile_image_url: null },
          Followers: [],
        },
        media: [
          { media_url: mockUrls[0], type: 'IMAGE' },
          { media_url: mockUrls[1], type: 'VIDEO' },
        ],
        likes: [],
        repostedBy: [],
        mentions: [],
      };

      const mockTx = {
        hashtag: {
          upsert: jest.fn().mockResolvedValue({ id: 1, tag: 'horrible' }),
        },
        post: {
          create: jest.fn().mockResolvedValue(mockCreatedPost),
        },
        media: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        mention: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      storageService.uploadFiles.mockResolvedValue(mockUrls);
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
      prisma.post.findMany.mockResolvedValue([mockRawPost]);
      prisma.post.findFirst.mockResolvedValue(null); 
      prisma.post.groupBy.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      postQueue.add.mockResolvedValue({});

      const result = await service.createPost(createPostDto);

      expect(storageService.uploadFiles).toHaveBeenCalledWith(mockFiles);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(postQueue.add).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.userId).toBe(1);
      expect(result.username).toBe('testuser');
    });

    it('should create a post without media', async () => {
      const createPostDto = {
        content: 'Simple text post #test',
        type: PostType.POST,
        visibility: PostVisibility.EVERY_ONE,
        userId: 1,
        media: undefined,
      };

      const mockCreatedPost = {
        id: 2,
        content: createPostDto.content,
        type: 'POST',
        visibility: 'EVERY_ONE',
        user_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        hashtags: [],
      };

      const mockRawPost = {
        ...mockCreatedPost,
        parent_id: null,
        _count: { likes: 0, repostedBy: 0 },
        quoteCount: 0,
        replyCount: 0,
        User: {
          id: 1,
          username: 'testuser',
          is_verified: false,
          Profile: { name: 'Test User', profile_image_url: null },
          Followers: [],
        },
        media: [],
        likes: [],
        repostedBy: [],
        mentions: [],
      };

      const mockTx = {
        hashtag: {
          upsert: jest.fn().mockResolvedValue({ id: 1, tag: 'test' }),
        },
        post: {
          create: jest.fn().mockResolvedValue(mockCreatedPost),
        },
        media: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        mention: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      storageService.uploadFiles.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
      prisma.post.findMany.mockResolvedValue([mockRawPost]);
      prisma.post.findFirst.mockResolvedValue(null);
      prisma.post.groupBy.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      postQueue.add.mockResolvedValue({});

      await service.createPost(createPostDto);

      expect(storageService.uploadFiles).toHaveBeenCalledWith(undefined);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should delete uploaded files if post creation fails', async () => {
      const mockUrls = ['https://s3/image.jpg'];
      const mockFiles = [{ mimetype: 'image/jpeg' }] as Express.Multer.File[];

      const createPostDto = {
        content: 'This will fail',
        type: PostType.POST,
        visibility: PostVisibility.EVERY_ONE,
        userId: 1,
        media: mockFiles,
      };

      storageService.uploadFiles.mockResolvedValue(mockUrls);
      storageService.deleteFiles = jest.fn().mockResolvedValue(undefined);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.post.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(new Error('Error'));

      await expect(service.createPost(createPostDto)).rejects.toThrow();
      expect(storageService.deleteFiles).toHaveBeenCalledWith(mockUrls);
    });
  });

  describe('getPostsWithFilters', () => {
    it('should get posts with user filter', async () => {
      const filter = {
        userId: 1,
        page: 1,
        limit: 10,
      };

      const mockPosts = [
        { id: 1, content: 'Post 1', user_id: 1 },
        { id: 2, content: 'Post 2', user_id: 1 },
      ];

      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getPostsWithFilters(filter);

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          is_deleted: false,
        },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockPosts);
    });

    it('should get posts with hashtag filter', async () => {
      const filter = {
        hashtag: 'pain',
        page: 1,
        limit: 10,
      };

      const mockPosts = [{ id: 1, content: 'Post with #pain', user_id: 1 }];

      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getPostsWithFilters(filter);

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          hashtags: { some: { tag: 'pain' } },
          is_deleted: false,
        },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockPosts);
    });

    it('should get posts with type filter', async () => {
      const filter = {
        type: PostType.QUOTE,
        page: 1,
        limit: 10,
      };

      const mockPosts = [{ id: 1, content: 'Quote post', user_id: 1, type: PostType.QUOTE }];

      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getPostsWithFilters(filter);

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          type: PostType.QUOTE,
          is_deleted: false,
        },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockPosts);
    });

    it('should get all posts when no filters provided', async () => {
      const filter = {
        page: 1,
        limit: 10,
      };

      const mockPosts = [{ id: 1, content: 'Public post', user_id: 1, visibility: PostVisibility.EVERY_ONE }];

      prisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await service.getPostsWithFilters(filter);

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
        },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe('getPostById', () => {
    it('should return a post by id', async () => {
      const postId = 1;
      const userId = 2;

      const mockPost = {
        id: postId,
        content: 'Test post',
        user_id: 1,
        type: 'POST',
        parent_id: null,
        created_at: new Date(),
        is_deleted: false,
        _count: { likes: 5, repostedBy: 2 },
        quoteCount: 0,
        replyCount: 3,
        User: {
          id: 1,
          username: 'testuser',
          is_verified: false,
          Profile: { name: 'Test User', profile_image_url: null },
          Followers: [{ followerId: userId }],
        },
        media: [],
        likes: [{ user_id: userId }],
        repostedBy: [],
        mentions: [],
      };

      prisma.post.findMany.mockResolvedValue([mockPost]);
      prisma.post.groupBy.mockResolvedValue([]);

      const [result] = await service.getPostById(postId, userId);

      expect(result.isLikedByMe).toBe(true);
      expect(result.isRepostedByMe).toBe(false);
    });

    it('should throw NotFoundException if post not found', async () => {
      const postId = 9231037;
      const userId = 1;

      prisma.post.findMany.mockResolvedValue([]);

      await expect(service.getPostById(postId, userId)).rejects.toThrow('Post not found');
    });

    it('should return enriched post for quote or reply', async () => {
      const postId = 1;
      const userId = 2;

      const mockPost = {
        userId: 1,
        username: 'testuser',
        verified: false,
        name: 'Test User',
        avatar: null,
        postId: 1,
        parentId: 2,
        type: 'REPLY',
        date: new Date(),
        likesCount: 5,
        retweetsCount: 2,
        commentsCount: 3,
        isLikedByMe: false,
        isFollowedByMe: false,
        isRepostedByMe: false,
        isMutedByMe: false,
        isBlockedByMe: false,
        text: 'Reply text',
        media: [],
        mentions: [],
        isRepost: false,
        isQuote: false,
      };

      const mockEnrichedPost = [{
        ...mockPost,
        originalPostData: {
          userId: 2,
          username: 'parentuser',
          verified: false,
          name: 'Parent User',
          avatar: null,
          postId: 2,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 10,
          retweetsCount: 5,
          commentsCount: 3,
          isLikedByMe: false,
          isFollowedByMe: true,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Parent post',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      }];

      jest.spyOn(service, 'findPosts').mockResolvedValue([mockPost]);
      jest.spyOn(service as any, 'enrichIfQuoteOrReply').mockResolvedValue(mockEnrichedPost);

      const result = await service.getPostById(postId, userId);

      expect(service.findPosts).toHaveBeenCalledWith({
        where: { id: postId, is_deleted: false },
        userId,
        page: 1,
        limit: 1,
      });
      expect(result).toEqual(mockEnrichedPost);
    });
  });

  describe('deletePost', () => {
    it('should soft delete a post', async () => {
      const postId = 1;

      const mockPost = { id: postId, is_deleted: false, parent_id: null, type: 'POST' };

      const mockTx = {
        post: {
          findFirst: jest.fn().mockResolvedValue(mockPost),
          update: jest.fn().mockResolvedValue(mockPost),
        },
        mention: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        like: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        repost: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      // Ensure the transaction callback receives the mocked tx and runs
      prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      const result = await service.deletePost(postId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ post: mockPost });
    });

    it('should throw NotFoundException if post to delete not found', async () => {
      const postId = 999;

      const mockTx = {
        post: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      await expect(service.deletePost(postId)).rejects.toThrow('Post not found');
    });

    it('should delete post with replies and quotes', async () => {
      const postId = 1;

      const mockPost = { id: postId, is_deleted: false, parent_id: null, type: 'POST' };
      const mockRepliesAndQuotes = [
        { id: 2 },
        { id: 3 },
      ];

      const mockTx = {
        post: {
          findFirst: jest.fn().mockResolvedValue(mockPost),
          update: jest.fn().mockResolvedValue(mockPost),
        },
        mention: {
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        like: {
          deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        repost: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      const result = await service.deletePost(postId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ post: mockPost });
      expect(mockTx.post.update).toHaveBeenCalledWith({
        where: { id: postId },
        data: { is_deleted: true },
      });
    });
  });

  describe('summarizePost', () => {
    it('should return existing summary if available', async () => {
      const postId = 1;
      const mockPost = {
        id: postId,
        content: 'Long story of cringe here',
        summary: 'Existing summary',
        is_deleted: false,
      };

      prisma.post.findFirst.mockResolvedValue(mockPost);

      const result = await service.summarizePost(postId);

      expect(result).toBe('Existing summary');
    });

    it('should throw NotFoundException if post not found', async () => {
      const postId = 9231037;

      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.summarizePost(postId)).rejects.toThrow('Post not found');
    });

    it('should throw error if post has no content', async () => {
      const postId = 1;
      const mockPost = {
        id: postId,
        content: null,
        summary: null,
        is_deleted: false,
      };

      prisma.post.findFirst.mockResolvedValue(mockPost);

      await expect(service.summarizePost(postId)).rejects.toThrow(
        'Post has no content to summarize',
      );
    });

    it('should generate new summary when none exists', async () => {
      const postId = 1;
      const mockPost = {
        id: postId,
        content: 'This is a long post that needs summarization',
        summary: null,
        is_deleted: false,
      };
      const expectedSummary = 'Generated summary';

      prisma.post.findFirst.mockResolvedValue(mockPost);
      jest.spyOn(service['aiSummarizationService'], 'summarizePost').mockResolvedValue(expectedSummary);

      const result = await service.summarizePost(postId);

      expect(result).toBe(expectedSummary);
      expect(service['aiSummarizationService'].summarizePost).toHaveBeenCalledWith(mockPost.content);
    });
  });

  describe('findPosts', () => {
    it('should find and transform posts with user interactions', async () => {
      const userId = 1;
      const options = {
        where: { is_deleted: false },
        userId,
        page: 1,
        limit: 10,
      };

      const mockRawPosts = [
        {
          id: 1,
          user_id: 1,
          content: 'Test post',
          type: 'POST',
          parent_id: null,
          created_at: new Date(),
          is_deleted: false,
          _count: { likes: 5, repostedBy: 2 },
          User: {
            id: 1,
            username: 'testuser',
            is_verified: false,
            Profile: { name: 'Test User', profile_image_url: null },
            Followers: [],
            Muters: [],
            Blockers: [],
          },
          media: [{ media_url: 'https://s3/image.jpg', type: 'IMAGE' }],
          likes: [{ user_id: userId }],
          repostedBy: [],
          mentions: [],
        },
      ];

      const mockCounts = [{ replies: 3, quotes: 1 }];

      prisma.post.findMany.mockResolvedValue(mockRawPosts);
      // Mock the private getPostCounts method
      jest.spyOn(service as any, 'getPostCounts').mockResolvedValue(mockCounts[0]);
      jest.spyOn(service as any, 'transformPost').mockReturnValue([
        {
          userId: 1,
          username: 'testuser',
          verified: false,
          name: 'Test User',
          avatar: null,
          postId: 1,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 5,
          retweetsCount: 3,
          commentsCount: 3,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Test post',
          media: [{ url: 'https://s3/image.jpg', type: 'IMAGE' }],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ]);

      const result = await service.findPosts(options);

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: { is_deleted: false },
        include: expect.any(Object),
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(1);
    });

    it('should return empty array when no posts found', async () => {
      const userId = 1;
      const options = {
        where: { is_deleted: false },
        userId,
        page: 1,
        limit: 10,
      };

      prisma.post.findMany.mockResolvedValue([]);
      jest.spyOn(service as any, 'getPostCounts').mockResolvedValue({ replies: 0, quotes: 0 });
      jest.spyOn(service as any, 'transformPost').mockReturnValue([]);

      const result = await service.findPosts(options);

      expect(result).toEqual([]);
    });
  });

  describe('getUserPosts', () => {
    it('should get user posts including reposts', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockPosts = [
        {
          userId: 1,
          username: 'testuser',
          verified: false,
          name: 'Test User',
          avatar: null,
          postId: 1,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 5,
          retweetsCount: 3,
          commentsCount: 3,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Test post',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      const mockReposts = [
        {
          userId: 1,
          username: 'testuser',
          verified: false,
          name: 'Test User',
          avatar: null,
          isFollowedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          date: new Date(),
          originalPostData: {
            userId: 2,
            username: 'otheruser',
            verified: false,
            name: 'Other User',
            avatar: null,
            postId: 2,
            parentId: null,
            type: 'POST',
            date: new Date(),
            likesCount: 10,
            retweetsCount: 5,
            commentsCount: 2,
            isLikedByMe: false,
            isFollowedByMe: true,
            isRepostedByMe: false,
            isMutedByMe: false,
            isBlockedByMe: false,
            text: 'Original post',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        },
      ];

      const mockCombinedResult = [
        {
          ...mockPosts[0],
          isRepost: false,
        },
        {
          ...mockReposts[0],
          isRepost: true,
        },
      ];

      jest.spyOn(service, 'findPosts').mockResolvedValue(mockPosts);
      jest.spyOn(service as any, 'getReposts').mockResolvedValue(mockReposts);
      jest.spyOn(service as any, 'enrichIfQuoteOrReply').mockResolvedValue(mockPosts);
      jest.spyOn(service as any, 'combineAndSort').mockReturnValue(mockCombinedResult);

      const result = await service.getUserPosts(userId, userId, page, limit);

      expect(service.findPosts).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          type: { in: [PostType.POST, PostType.QUOTE] },
          is_deleted: false,
        },
        userId,
        page: 1,
        limit: 10, // safetyLimit = page * limit
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getUserMedia', () => {
    it('should get user media with pagination', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockMedia = [
        {
          id: 1,
          user_id: userId,
          post_id: 1,
          media_url: 'https://s3/image1.jpg',
          type: 'IMAGE',
          created_at: new Date(),
        },
        {
          id: 2,
          user_id: userId,
          post_id: 2,
          media_url: 'https://s3/image2.jpg',
          type: 'IMAGE',
          created_at: new Date(),
        },
      ];

      prisma.media.findMany.mockResolvedValue(mockMedia);

      const result = await service.getUserMedia(userId, page, limit);

      expect(prisma.media.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockMedia);
    });

    it('should return empty array when user has no media', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      prisma.media.findMany.mockResolvedValue([]);

      const result = await service.getUserMedia(userId, page, limit);

      expect(prisma.media.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual([]);
    });
  });

  describe('getUserReplies', () => {
    it('should get user replies and enrich them', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockReplies = [
        {
          userId: 1,
          username: 'testuser',
          verified: false,
          name: 'Test User',
          avatar: null,
          postId: 1,
          parentId: 2,
          type: 'REPLY',
          date: new Date(),
          likesCount: 2,
          retweetsCount: 1,
          commentsCount: 0,
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Reply text',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      const mockEnrichedReplies = [
        {
          ...mockReplies[0],
          originalPostData: {
            userId: 2,
            username: 'parentuser',
            verified: false,
            name: 'Parent User',
            avatar: null,
            postId: 2,
            parentId: null,
            type: 'POST',
            date: new Date(),
            likesCount: 10,
            retweetsCount: 5,
            commentsCount: 3,
            isLikedByMe: false,
            isFollowedByMe: true,
            isRepostedByMe: false,
            isMutedByMe: false,
            isBlockedByMe: false,
            text: 'Parent post',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        },
      ];

      jest.spyOn(service, 'findPosts').mockResolvedValue(mockReplies);
      jest.spyOn(service as any, 'enrichIfQuoteOrReply').mockResolvedValue(mockEnrichedReplies);

      const result = await service.getUserReplies(userId, page, limit);

      expect(service.findPosts).toHaveBeenCalledWith({
        where: {
          type: PostType.REPLY,
          user_id: userId,
          is_deleted: false,
        },
        userId,
        page,
        limit,
      });
      expect(result).toEqual(mockEnrichedReplies);
    });

    it('should return empty array when user has no replies', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      jest.spyOn(service, 'findPosts').mockResolvedValue([]);
      jest.spyOn(service as any, 'enrichIfQuoteOrReply').mockResolvedValue([]);

      const result = await service.getUserReplies(userId, page, limit);

      expect(service.findPosts).toHaveBeenCalledWith({
        where: {
          type: PostType.REPLY,
          user_id: userId,
          is_deleted: false,
        },
        userId,
        page,
        limit,
      });
      expect(result).toEqual([]);
    });
  });

  describe('getRepliesOfPost', () => {
    it('should get replies for a specific post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;
      const userId = 2;

      const mockReplies = [
        {
          userId: 2,
          username: 'replyuser',
          verified: false,
          name: 'Reply User',
          avatar: null,
          postId: 3,
          parentId: postId,
          type: 'REPLY',
          date: new Date(),
          likesCount: 1,
          retweetsCount: 0,
          commentsCount: 0,
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'This is a reply',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      jest.spyOn(service, 'findPosts').mockResolvedValue(mockReplies);

      const result = await service.getRepliesOfPost(postId, page, limit, userId);

      expect(service.findPosts).toHaveBeenCalledWith({
        where: {
          type: PostType.REPLY,
          parent_id: postId,
          is_deleted: false,
        },
        userId,
        page,
        limit,
      });
      expect(result).toEqual(mockReplies);
    });

    it('should return empty array when post has no replies', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;
      const userId = 2;

      jest.spyOn(service, 'findPosts').mockResolvedValue([]);

      const result = await service.getRepliesOfPost(postId, page, limit, userId);

      expect(service.findPosts).toHaveBeenCalledWith({
        where: {
          type: PostType.REPLY,
          parent_id: postId,
          is_deleted: false,
        },
        userId,
        page,
        limit,
      });
      expect(result).toEqual([]);
    });
  });
});
