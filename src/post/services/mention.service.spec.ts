import { Test, TestingModule } from '@nestjs/testing';
import { MentionService } from './mention.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Services } from 'src/utils/constants';

describe('MentionService', () => {
  let service: MentionService;
  let prisma: any;
  let postService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      post: {
        findUnique: jest.fn(),
      },
      mention: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockPostService = {
      findPosts: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentionService,
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

    service = module.get<MentionService>(MentionService);
    prisma = module.get(Services.PRISMA);
    postService = module.get(Services.POST);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMentionedPosts', () => {
    const userId = 1;
    const page = 1;
    const limit = 10;

    it('should return posts where user was mentioned', async () => {
      const mockMentions = [
        { post_id: 1, created_at: new Date('2024-01-01') },
        { post_id: 2, created_at: new Date('2024-01-02') },
        { post_id: 3, created_at: new Date('2024-01-03') },
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
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post mentioning user',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
        {
          postId: 2,
          userId: 3,
          username: 'user3',
          verified: true,
          name: 'User Three',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 10,
          retweetsCount: 5,
          commentsCount: 3,
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Another mention post',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
        {
          postId: 3,
          userId: 4,
          username: 'user4',
          verified: false,
          name: 'User Four',
          avatar: null,
          parentId: null,
          type: 'POST',
          date: new Date(),
          likesCount: 8,
          retweetsCount: 2,
          commentsCount: 1,
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Third mention',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);
      postService.findPosts.mockResolvedValue(mockPosts);

      const result = await service.getMentionedPosts(userId, page, limit);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        distinct: ['post_id'],
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(postService.findPosts).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
          id: { in: [1, 2, 3] },
        },
        userId,
        limit,
        page,
      });
      expect(result).toEqual(mockPosts);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when user has no mentions', async () => {
      prisma.mention.findMany.mockResolvedValue([]);
      postService.findPosts.mockResolvedValue([]);

      const result = await service.getMentionedPosts(userId, page, limit);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        distinct: ['post_id'],
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
      expect(result).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const page2 = 2;
      const limit5 = 5;
      const mockMentions = [
        { post_id: 6, created_at: new Date('2024-01-06') },
      ];

      const mockPosts = [
        {
          postId: 6,
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
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Page 2 mention',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);
      postService.findPosts.mockResolvedValue(mockPosts);

      const result = await service.getMentionedPosts(userId, page2, limit5);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        distinct: ['post_id'],
        orderBy: { created_at: 'desc' },
        skip: 5,
        take: 5,
      });
      expect(result).toHaveLength(1);
    });

    it('should filter out deleted posts', async () => {
      const mockMentions = [
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
          isLikedByMe: false,
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

      prisma.mention.findMany.mockResolvedValue(mockMentions);
      postService.findPosts.mockResolvedValue(mockPosts);

      const result = await service.getMentionedPosts(userId, page, limit);

      expect(postService.findPosts).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
          id: { in: [1, 2] },
        },
        userId,
        limit,
        page,
      });
      // Post 2 was deleted, only post 1 returned
      expect(result).toHaveLength(1);
      expect(result[0].postId).toBe(1);
    });

    it('should use distinct to avoid duplicate posts', async () => {
      const mockMentions = [
        { post_id: 1, created_at: new Date('2024-01-01') },
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
          isLikedByMe: false,
          isFollowedByMe: false,
          isRepostedByMe: false,
          isMutedByMe: false,
          isBlockedByMe: false,
          text: 'Post with multiple mentions',
          media: [],
          mentions: [],
          isRepost: false,
          isQuote: false,
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);
      postService.findPosts.mockResolvedValue(mockPosts);

      const result = await service.getMentionedPosts(userId, page, limit);

      expect(prisma.mention.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          distinct: ['post_id'],
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getMentionsForPost', () => {
    const postId = 1;
    const page = 1;
    const limit = 10;

    it('should return list of users mentioned in a post', async () => {
      const mockMentions = [
        {
          user: {
            id: 1,
            username: 'user1',
            email: 'user1@example.com',
            is_verified: true,
          },
        },
        {
          user: {
            id: 2,
            username: 'user2',
            email: 'user2@example.com',
            is_verified: false,
          },
        },
        {
          user: {
            id: 3,
            username: 'user3',
            email: 'user3@example.com',
            is_verified: true,
          },
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);

      const result = await service.getMentionsForPost(postId, page, limit);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { post_id: postId },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              is_verified: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual([
        {
          id: 1,
          username: 'user1',
          email: 'user1@example.com',
          is_verified: true,
        },
        {
          id: 2,
          username: 'user2',
          email: 'user2@example.com',
          is_verified: false,
        },
        {
          id: 3,
          username: 'user3',
          email: 'user3@example.com',
          is_verified: true,
        },
      ]);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when post has no mentions', async () => {
      prisma.mention.findMany.mockResolvedValue([]);

      const result = await service.getMentionsForPost(postId, page, limit);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { post_id: postId },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              is_verified: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const page2 = 2;
      const limit5 = 5;
      const mockMentions = [
        {
          user: {
            id: 6,
            username: 'user6',
            email: 'user6@example.com',
            is_verified: false,
          },
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);

      const result = await service.getMentionsForPost(postId, page2, limit5);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { post_id: postId },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              is_verified: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: 5,
        take: 5,
      });
      expect(result).toHaveLength(1);
    });

    it('should use default pagination values when not provided', async () => {
      const mockMentions = [
        {
          user: {
            id: 1,
            username: 'user1',
            email: 'user1@example.com',
            is_verified: true,
          },
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);

      const result = await service.getMentionsForPost(postId);

      expect(prisma.mention.findMany).toHaveBeenCalledWith({
        where: { post_id: postId },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              is_verified: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toHaveLength(1);
    });

    it('should order mentions by created_at desc', async () => {
      const mockMentions = [
        {
          user: {
            id: 3,
            username: 'user3',
            email: 'user3@example.com',
            is_verified: false,
          },
        },
        {
          user: {
            id: 1,
            username: 'user1',
            email: 'user1@example.com',
            is_verified: true,
          },
        },
      ];

      prisma.mention.findMany.mockResolvedValue(mockMentions);

      const result = await service.getMentionsForPost(postId, page, limit);

      expect(prisma.mention.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
      // Order should be preserved from the query result
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(1);
    });
  });
});
