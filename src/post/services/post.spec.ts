import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PostService } from './post.service';
import { StorageService } from 'src/storage/storage.service';
import { getQueueToken } from '@nestjs/bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { Queue } from 'bullmq';
import { PostType, PostVisibility } from '@prisma/client';
import { MLService } from './ml.service';

describe('Post Service', () => {
  let service: PostService;
  let prisma: any;
  let storageService: any;
  let postQueue: any;

  beforeEach(async () => {
    const mockMLService = {
      rankPosts: jest.fn(),
      predictQualityScore: jest.fn(),
    };

    const mockAiSummarizationService = {
      summarizePost: jest.fn(),
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
            },
            user: {
              findUnique: jest.fn(),
            },
            like: {
              create: jest.fn(),
              delete: jest.fn(),
              findUnique: jest.fn(),
            },
            repost: {
              create: jest.fn(),
              delete: jest.fn(),
              findUnique: jest.fn(),
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
        _count: { likes: 0, repostedBy: 0, Replies: 0 },
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
      };

      storageService.uploadFiles.mockResolvedValue(mockUrls);
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
      prisma.post.findMany.mockResolvedValue([mockRawPost]);
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
        _count: { likes: 0, repostedBy: 0, Replies: 0 },
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
      };

      storageService.uploadFiles.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
      prisma.post.findMany.mockResolvedValue([mockRawPost]);
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
  });

  describe('getPostById', () => {
    it('should return a post by id', async () => {
      const postId = 1;
      const userId = 2;

      const mockPost = {
        id: postId,
        content: 'Test post',
        user_id: 1,
        _count: { likes: 5, repostedBy: 2, Replies: 3 },
        User: {
          id: 1,
          username: 'testuser',
        },
        media: [],
        likes: [{ user_id: userId }],
        repostedBy: [],
      };

      prisma.post.findFirst.mockResolvedValue(mockPost);

      const result = await service.getPostById(postId, userId);

      expect(result.isLikedByMe).toBe(true);
      expect(result.isRepostedByMe).toBe(false);
    });

    it('should throw NotFoundException if post not found', async () => {
      const postId = 9231037;
      const userId = 1;

      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.getPostById(postId, userId)).rejects.toThrow('Post not found');
    });
  });

  describe('deletePost', () => {
    it('should soft delete a post', async () => {
      const postId = 1;

      const mockPost = { id: postId, is_deleted: false };
      const mockUpdateResult = { count: 1 };

      const mockTx = {
        post: {
          findFirst: jest.fn().mockResolvedValue(mockPost),
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue(mockUpdateResult),
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

      prisma.$transaction.mockImplementation((c) => c(mockTx));

      const result = await service.deletePost(postId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockUpdateResult);
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
  });
});
