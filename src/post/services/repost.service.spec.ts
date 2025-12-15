import { Test, TestingModule } from '@nestjs/testing';
import { RepostService } from './repost.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Services } from 'src/utils/constants';
import { NotificationType } from 'src/notifications/enums/notification.enum';

describe('RepostService', () => {
  let service: RepostService;
  let prisma: any;
  let postService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    const mockPrismaService = {
      repost: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      post: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockPostService = {
      checkPostExists: jest.fn().mockResolvedValue(true),
      updatePostStatsCache: jest.fn().mockResolvedValue(undefined),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepostService,
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

    service = module.get<RepostService>(RepostService);
    prisma = module.get(Services.PRISMA);
    postService = module.get(Services.POST);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('toggleRepost', () => {
    const postId = 1;
    const userId = 2;

    it('should remove repost when it already exists', async () => {
      const existingRepost = {
        post_id: postId,
        user_id: userId,
      };

      prisma.repost.findUnique.mockResolvedValue(existingRepost);
      prisma.repost.delete.mockResolvedValue(existingRepost);

      const result = await service.toggleRepost(postId, userId);

      expect(postService.checkPostExists).toHaveBeenCalledWith(postId);
      expect(prisma.repost.findUnique).toHaveBeenCalledWith({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });
      expect(prisma.repost.delete).toHaveBeenCalledWith({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'retweetsCount', -1);
      expect(result).toEqual({ message: 'Repost removed' });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should create repost and emit notification when repost does not exist', async () => {
      const postAuthorId = 3;
      const mockPost = { user_id: postAuthorId };

      prisma.repost.findUnique.mockResolvedValue(null);
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.repost.create.mockResolvedValue({
        post_id: postId,
        user_id: userId,
      });

      const result = await service.toggleRepost(postId, userId);

      expect(prisma.repost.findUnique).toHaveBeenCalledWith({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });
      expect(prisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: postId },
        select: { user_id: true },
      });
      expect(prisma.repost.create).toHaveBeenCalledWith({
        data: { post_id: postId, user_id: userId },
      });
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'retweetsCount', 1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.create', {
        type: NotificationType.REPOST,
        recipientId: postAuthorId,
        actorId: userId,
        postId,
      });
      expect(result).toEqual({ message: 'Post reposted' });
    });

    it('should not emit notification when user reposts their own post', async () => {
      const ownUserId = 2;
      const mockPost = { user_id: ownUserId };

      prisma.repost.findUnique.mockResolvedValue(null);
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.repost.create.mockResolvedValue({
        post_id: postId,
        user_id: ownUserId,
      });

      const result = await service.toggleRepost(postId, ownUserId);

      expect(prisma.repost.create).toHaveBeenCalled();
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'retweetsCount', 1);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Post reposted' });
    });

    it('should handle case when post is not found during repost', async () => {
      prisma.repost.findUnique.mockResolvedValue(null);
      prisma.post.findUnique.mockResolvedValue(null);
      prisma.repost.create.mockResolvedValue({
        post_id: postId,
        user_id: userId,
      });

      const result = await service.toggleRepost(postId, userId);

      expect(prisma.repost.create).toHaveBeenCalled();
      expect(postService.updatePostStatsCache).toHaveBeenCalledWith(postId, 'retweetsCount', 1);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Post reposted' });
    });
  });

  describe('getReposters', () => {
    const postId = 1;
    const page = 1;
    const limit = 10;

    it('should return list of users who reposted a post', async () => {
      const mockReposters = [
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

      prisma.repost.findMany.mockResolvedValue(mockReposters);

      const result = await service.getReposters(postId, page, limit);

      expect(prisma.repost.findMany).toHaveBeenCalledWith({
        where: { post_id: postId },
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

    it('should return empty array when no users reposted', async () => {
      prisma.repost.findMany.mockResolvedValue([]);

      const result = await service.getReposters(postId, page, limit);

      expect(result).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const page = 2;
      const limit = 5;

      const mockReposters = [
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

      prisma.repost.findMany.mockResolvedValue(mockReposters);

      const result = await service.getReposters(postId, page, limit);

      expect(prisma.repost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should handle users without profiles', async () => {
      const mockReposters = [
        {
          user: {
            id: 1,
            username: 'user1',
            is_verified: false,
            Profile: null,
          },
        },
      ];

      prisma.repost.findMany.mockResolvedValue(mockReposters);

      const result = await service.getReposters(postId, page, limit);

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
});
