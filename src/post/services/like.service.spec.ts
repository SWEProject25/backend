import { Test, TestingModule } from '@nestjs/testing';
import { LikeService } from './like.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Services } from 'src/utils/constants';
import { NotificationType } from 'src/notifications/enums/notification.enum';

describe('LikeService', () => {
  let service: LikeService;
  let prisma: any;
  let postService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    const mockPrismaService = {
      like: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      post: {
        findUnique: jest.fn(),
      },
    };

    const mockPostService = {
      findPosts: jest.fn(),
      updatePostStatsCache: jest.fn(),
      checkPostExists: jest.fn().mockResolvedValue(true),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikeService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.POST,
          useValue: mockPostService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<LikeService>(LikeService);
    prisma = module.get(Services.PRISMA);
    postService = module.get(Services.POST);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('togglePostLike', () => {
    const postId = 1;
    const userId = 2;

    it('should unlike a post when like exists', async () => {
      const existingLike = {
        post_id: postId,
        user_id: userId,
      };

      prisma.like.findUnique.mockResolvedValue(existingLike);
      prisma.like.delete.mockResolvedValue(existingLike);
      postService.updatePostStatsCache.mockResolvedValue(undefined);

      const result = await service.togglePostLike(postId, userId);

      expect(prisma.like.findUnique).toHaveBeenCalledWith({
        where: {
          post_id_user_id: {
            post_id: postId,
            user_id: userId,
          },
        },
      });
      expect(prisma.like.delete).toHaveBeenCalledWith({
        where: {
          post_id_user_id: {
            post_id: postId,
            user_id: userId,
          },
        },
      });
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'likesCount', -1);
      expect(result).toEqual({ liked: false, message: 'Post unliked' });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should like a post when like does not exist', async () => {
      const postAuthorId = 3;
      const mockPost = {
        id: postId,
        user_id: postAuthorId,
      };

      prisma.like.findUnique.mockResolvedValue(null);
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.like.create.mockResolvedValue({
        post_id: postId,
        user_id: userId,
      });
      postService.updatePostStatsCache.mockResolvedValue(undefined);

      const result = await service.togglePostLike(postId, userId);

      expect(prisma.like.findUnique).toHaveBeenCalledWith({
        where: {
          post_id_user_id: {
            post_id: postId,
            user_id: userId,
          },
        },
      });
      expect(prisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: postId },
        select: { user_id: true },
      });
      expect(prisma.like.create).toHaveBeenCalledWith({
        data: {
          post_id: postId,
          user_id: userId,
        },
      });
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'likesCount', 1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.create', {
        type: NotificationType.LIKE,
        recipientId: postAuthorId,
        actorId: userId,
        postId,
      });
      expect(result).toEqual({ liked: true, message: 'Post liked' });
    });

    it('should not emit notification when user likes their own post', async () => {
      const ownPostId = 1;
      const ownUserId = 2;
      const mockPost = {
        id: ownPostId,
        user_id: ownUserId,
      };

      prisma.like.findUnique.mockResolvedValue(null);
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.like.create.mockResolvedValue({
        post_id: ownPostId,
        user_id: ownUserId,
      });
      postService.updatePostStatsCache.mockResolvedValue(undefined);

      const result = await service.togglePostLike(ownPostId, ownUserId);

      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(ownPostId, 'likesCount', 1);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result).toEqual({ liked: true, message: 'Post liked' });
    });

    it('should handle case when post is not found', async () => {
      prisma.like.findUnique.mockResolvedValue(null);
      prisma.post.findUnique.mockResolvedValue(null);
      prisma.like.create.mockResolvedValue({
        post_id: postId,
        user_id: userId,
      });
      postService.updatePostStatsCache.mockResolvedValue(undefined);

      const result = await service.togglePostLike(postId, userId);

      expect(prisma.like.create).toHaveBeenCalled();
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'likesCount', 1);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result).toEqual({ liked: true, message: 'Post liked' });
    });
  });

  describe('getListOfLikers', () => {
    it('should return list of users who liked a post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockLikers = [
        {
          user: {
            id: 1,
            username: 'user1',
            is_verified: true,
            Profile: {
              name: 'User One',
              profile_image_url: 'https://example.com/user1.jpg',
            },
          },
        },
        {
          user: {
            id: 2,
            username: 'user2',
            is_verified: false,
            Profile: {
              name: 'User Two',
              profile_image_url: null,
            },
          },
        },
      ];

      prisma.like.findMany.mockResolvedValue(mockLikers);

      const result = await service.getListOfLikers(postId, page, limit);

      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: {
          post_id: postId,
        },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              is_verified: true,
              Profile: {
                select: {
                  name: true,
                  profile_image_url: true,
                },
              },
            },
          },
        },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual([
        {
          id: 1,
          username: 'user1',
          verified: true,
          name: 'User One',
          profileImageUrl: 'https://example.com/user1.jpg',
        },
        {
          id: 2,
          username: 'user2',
          verified: false,
          name: 'User Two',
          profileImageUrl: null,
        },
      ]);
    });

    it('should return empty array when no users liked the post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      prisma.like.findMany.mockResolvedValue([]);

      const result = await service.getListOfLikers(postId, page, limit);

      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: {
          post_id: postId,
        },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              is_verified: true,
              Profile: {
                select: {
                  name: true,
                  profile_image_url: true,
                },
              },
            },
          },
        },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const postId = 1;
      const page = 2;
      const limit = 5;

      const mockLikers = [
        {
          user: {
            id: 6,
            username: 'user6',
            is_verified: false,
            Profile: {
              name: 'User Six',
              profile_image_url: null,
            },
          },
        },
      ];

      prisma.like.findMany.mockResolvedValue(mockLikers);

      const result = await service.getListOfLikers(postId, page, limit);

      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: {
          post_id: postId,
        },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              is_verified: true,
              Profile: {
                select: {
                  name: true,
                  profile_image_url: true,
                },
              },
            },
          },
        },
        skip: 5,
        take: 5,
      });
      expect(result).toHaveLength(1);
    });

    it('should handle users without profiles', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockLikers = [
        {
          user: {
            id: 1,
            username: 'user1',
            is_verified: false,
            Profile: null,
          },
        },
      ];

      prisma.like.findMany.mockResolvedValue(mockLikers);

      const result = await service.getListOfLikers(postId, page, limit);

      expect(result).toEqual([
        {
          id: 1,
          username: 'user1',
          verified: false,
          name: undefined,
          profileImageUrl: undefined,
        },
      ]);
    });
  });

  describe('getLikedPostsByUser', () => {
    it('should return liked posts by user in correct order', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockLikes = [
        { post_id: 3, created_at: new Date('2024-01-03') },
        { post_id: 1, created_at: new Date('2024-01-01') },
        { post_id: 2, created_at: new Date('2024-01-02') },
      ];

      const mockPosts = [
        {
          postId: 1,
          userId: 2,
          username: 'user2',
          verified: false,
          name: 'User Two',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 5,
          retweetsCount: 3,
          commentsCount: 2,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post 1',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
        {
          postId: 2,
          userId: 3,
          username: 'user3',
          verified: false,
          name: 'User Three',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 10,
          retweetsCount: 5,
          commentsCount: 3,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post 2',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
        {
          postId: 3,
          userId: 4,
          username: 'user4',
          verified: true,
          name: 'User Four',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 8,
          retweetsCount: 2,
          commentsCount: 1,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post 3',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      prisma.like.findMany.mockResolvedValue(mockLikes);
      postService.findPosts.mockResolvedValue({ data: mockPosts, metadata: { totalItems: mockPosts.length, page, limit, totalPages: 1 } });

      const result = await service.getLikedPostsByUser(userId, page, limit);

      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(postService.findPosts).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
          id: { in: [3, 1, 2] },
        },
        userId,
        limit,
        page,
      });
      // Posts should be sorted in the order they were liked (3, 1, 2)
      expect(result.data).toHaveLength(3);
      expect(result.data[0].postId).toBe(3);
      expect(result.data[1].postId).toBe(1);
      expect(result.data[2].postId).toBe(2);
    });

    it('should return empty array when user has not liked any posts', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      prisma.like.findMany.mockResolvedValue([]);
      postService.findPosts.mockResolvedValue({ data: [], metadata: { totalItems: 0, page, limit, totalPages: 0 } });

      const result = await service.getLikedPostsByUser(userId, page, limit);

      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(postService.findPosts).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
          id: { in: [] },
        },
        userId,
        limit,
        page,
      });
      expect(result.data).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const userId = 1;
      const page = 2;
      const limit = 5;

      const mockLikes = [
        { post_id: 10, created_at: new Date('2024-01-10') },
      ];

      const mockPosts = [
        {
          postId: 10,
          userId: 5,
          username: 'user5',
          verified: false,
          name: 'User Five',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 3,
          retweetsCount: 1,
          commentsCount: 0,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post 10',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      prisma.like.findMany.mockResolvedValue(mockLikes);
      postService.findPosts.mockResolvedValue({ data: mockPosts, metadata: { totalItems: mockPosts.length, page, limit, totalPages: 1 } });

      const result = await service.getLikedPostsByUser(userId, page, limit);

      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip: 5,
        take: 5,
      });
      expect(result.data).toHaveLength(1);
    });

    it('should filter out deleted posts', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockLikes = [
        { post_id: 1, created_at: new Date('2024-01-01') },
        { post_id: 2, created_at: new Date('2024-01-02') },
      ];

      const mockPosts = [
        {
          postId: 1,
          userId: 2,
          username: 'user2',
          verified: false,
          name: 'User Two',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 5,
          retweetsCount: 3,
          commentsCount: 2,
          isLikedByMe: true,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post 1',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      prisma.like.findMany.mockResolvedValue(mockLikes);
      postService.findPosts.mockResolvedValue({ data: mockPosts, metadata: { totalItems: mockPosts.length, page, limit, totalPages: 1 } });

      const result = await service.getLikedPostsByUser(userId, page, limit);

      expect(postService.findPosts).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
          id: { in: [1, 2] },
        },
        userId,
        limit,
        page,
      });
      // Only one post returned (post 2 was deleted)
      expect(result.data).toHaveLength(1);
      expect(result.data[0].postId).toBe(1);
    });
  });
});
