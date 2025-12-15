import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './services/post.service';
import { LikeService } from './services/like.service';
import { RepostService } from './services/repost.service';
import { MentionService } from './services/mention.service';
import { Services } from 'src/utils/constants';
import { PostType, PostVisibility } from '@prisma/client';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';

describe('PostController', () => {
  let controller: PostController;
  let postService: any;
  let likeService: any;
  let repostService: any;
  let mentionService: any;

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    is_verified: false,
    provider_id: null,
    role: 'USER',
    has_completed_interests: true,
    created_at: new Date(),
    updated_at: new Date(),
  } as AuthenticatedUser;

  beforeEach(async () => {
    const mockPostService = {
      createPost: jest.fn(),
      getPostsWithFilters: jest.fn(),
      getPostById: jest.fn(),
      summarizePost: jest.fn(),
      getRepliesOfPost: jest.fn(),
      deletePost: jest.fn(),
      getUserPosts: jest.fn(),
      getUserReplies: jest.fn(),
      getUserMedia: jest.fn(),
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
      getMentionedPosts: jest.fn(),
      getMentionsForPost: jest.fn(),
    };

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
    postService = module.get(Services.POST);
    likeService = module.get(Services.LIKE);
    repostService = module.get(Services.REPOST);
    mentionService = module.get(Services.MENTION);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const createPostDto = {
        content: 'Test post content',
        type: PostType.POST,
        visibility: PostVisibility.EVERY_ONE,
        userId: 0,
        media: undefined,
      };

      const mockPost = {
        userId: 1,
        username: 'testuser',
        verified: false,
        name: 'Test User',
        avatar: null,
        postId: 1,
        parentId: null,
        type: 'POST',
        date: new Date(),
        likesCount: 0,
        retweetsCount: 0,
        commentsCount: 0,
        isLikedByMe: false,
        isFollowedByMe: false,
        isRepostedByMe: false,
        isMutedByMe: false,
        isBlockedByMe: false,
        text: 'Test post content',
        media: [],
        mentions: [],
        isRepost: false,
        isQuote: false,
      };

      postService.createPost.mockResolvedValue(mockPost);

      const result = await controller.createPost(createPostDto, mockUser, []);

      expect(postService.createPost).toHaveBeenCalledWith({
        ...createPostDto,
        userId: mockUser.id,
        media: [],
      });
      expect(result).toEqual({
        status: 'success',
        message: 'Post created successfully',
        data: mockPost,
      });
    });

    it('should create a post with media', async () => {
      const createPostDto = {
        content: 'Test post with media',
        type: PostType.POST,
        visibility: PostVisibility.EVERY_ONE,
        userId: 0,
        media: undefined,
      };

      const mockFiles = [
        { mimetype: 'image/jpeg', filename: 'test.jpg' },
      ] as Express.Multer.File[];

      const mockPost = {
        userId: 1,
        username: 'testuser',
        verified: false,
        name: 'Test User',
        avatar: null,
        postId: 1,
        parentId: null,
        type: 'POST',
        date: new Date(),
        likesCount: 0,
        retweetsCount: 0,
        commentsCount: 0,
        isLikedByMe: false,
        isFollowedByMe: false,
        isRepostedByMe: false,
        isMutedByMe: false,
        isBlockedByMe: false,
        text: 'Test post with media',
        media: [{ url: 'https://example.com/test.jpg', type: 'IMAGE' }],
        mentions: [],
        isRepost: false,
        isQuote: false,
      };

      postService.createPost.mockResolvedValue(mockPost);

      const result = await controller.createPost(createPostDto, mockUser, mockFiles);

      expect(postService.createPost).toHaveBeenCalledWith({
        ...createPostDto,
        userId: mockUser.id,
        media: mockFiles,
      });
      expect(result.data.media).toHaveLength(1);
    });
  });

  describe('getPosts', () => {
    it('should get posts with filters', async () => {
      const filters = {
        page: 1,
        limit: 10,
      };

      const mockPosts = [
        {
          id: 1,
          content: 'Post 1',
          user_id: 1,
          type: 'POST',
          visibility: 'EVERY_ONE',
        },
        {
          id: 2,
          content: 'Post 2',
          user_id: 2,
          type: 'POST',
          visibility: 'EVERY_ONE',
        },
      ];

      postService.getPostsWithFilters.mockResolvedValue(mockPosts);

      const result = await controller.getPosts(filters, mockUser);

      expect(postService.getPostsWithFilters).toHaveBeenCalledWith(filters);
      expect(result).toEqual({
        status: 'success',
        message: 'Posts retrieved successfully',
        data: mockPosts,
      });
    });

    it('should get posts filtered by userId', async () => {
      const filters = {
        userId: 1,
        page: 1,
        limit: 10,
      };

      const mockPosts = [
        {
          id: 1,
          content: 'User 1 post',
          user_id: 1,
          type: 'POST',
          visibility: 'EVERY_ONE',
        },
      ];

      postService.getPostsWithFilters.mockResolvedValue(mockPosts);

      const result = await controller.getPosts(filters, mockUser);

      expect(postService.getPostsWithFilters).toHaveBeenCalledWith(filters);
      expect(result.data).toEqual(mockPosts);
    });
  });

  describe('getPostById', () => {
    it('should get a post by id', async () => {
      const postId = 1;

      const mockPost = [
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
          retweetsCount: 2,
          commentsCount: 3,
          isLikedByMe: false,
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

      postService.getPostById.mockResolvedValue(mockPost);

      const result = await controller.getPostById(postId, mockUser);

      expect(postService.getPostById).toHaveBeenCalledWith(postId, mockUser.id);
      expect(result).toEqual({
        status: 'success',
        message: 'Post retrieved successfully',
        data: mockPost,
      });
    });

    it('should throw NotFoundException if post not found', async () => {
      const postId = 999;

      postService.getPostById.mockRejectedValue(new Error('Post not found'));

      await expect(controller.getPostById(postId, mockUser)).rejects.toThrow('Post not found');
    });
  });

  describe('getPostSummary', () => {
    it('should get post summary', async () => {
      const postId = 1;
      const mockSummary = 'This is a summary of the post';

      postService.summarizePost.mockResolvedValue(mockSummary);

      const result = await controller.getPostSummary(postId);

      expect(postService.summarizePost).toHaveBeenCalledWith(postId);
      expect(result).toEqual({
        status: 'success',
        message: 'Post summarized successfully',
        data: mockSummary,
      });
    });

    it('should throw error if post has no content to summarize', async () => {
      const postId = 1;

      postService.summarizePost.mockRejectedValue(new Error('Post has no content to summarize'));

      await expect(controller.getPostSummary(postId)).rejects.toThrow(
        'Post has no content to summarize',
      );
    });
  });

  describe('togglePostLike', () => {
    it('should like a post', async () => {
      const postId = 1;
      const mockResult = { liked: true, message: 'Post liked' };

      likeService.togglePostLike.mockResolvedValue(mockResult);

      const result = await controller.togglePostLike(postId, mockUser);

      expect(likeService.togglePostLike).toHaveBeenCalledWith(postId, mockUser.id);
      expect(result).toEqual({
        status: 'success',
        message: 'Post liked',
        data: mockResult,
      });
    });

    it('should unlike a post', async () => {
      const postId = 1;
      const mockResult = { liked: false, message: 'Post unliked' };

      likeService.togglePostLike.mockResolvedValue(mockResult);

      const result = await controller.togglePostLike(postId, mockUser);

      expect(likeService.togglePostLike).toHaveBeenCalledWith(postId, mockUser.id);
      expect(result).toEqual({
        status: 'success',
        message: 'Post unliked',
        data: mockResult,
      });
    });
  });

  describe('getPostLikers', () => {
    it('should get list of users who liked a post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockLikers = [
        {
          id: 1,
          username: 'user1',
          verified: false,
          name: 'User One',
          profileImageUrl: 'https://example.com/user1.jpg',
        },
        {
          id: 2,
          username: 'user2',
          verified: true,
          name: 'User Two',
          profileImageUrl: null,
        },
      ];

      likeService.getListOfLikers.mockResolvedValue(mockLikers);

      const result = await controller.getPostLikers(postId, page, limit);

      expect(likeService.getListOfLikers).toHaveBeenCalledWith(postId, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Likers retrieved successfully',
        data: mockLikers,
      });
    });

    it('should return empty array when no likers', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      likeService.getListOfLikers.mockResolvedValue([]);

      const result = await controller.getPostLikers(postId, page, limit);

      expect(result.data).toEqual([]);
    });
  });

  describe('getPostReplies', () => {
    it('should get replies for a post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockReplies = {
        data: [
          {
            userId: 2,
            username: 'replyuser',
            verified: false,
            name: 'Reply User',
            avatar: null,
            postId: 2,
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
        ],
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      postService.getRepliesOfPost.mockResolvedValue(mockReplies);

      const result = await controller.getPostReplies(postId, page, limit, mockUser);

      expect(postService.getRepliesOfPost).toHaveBeenCalledWith(postId, page, limit, mockUser.id);
      expect(result).toEqual({
        status: 'success',
        message: 'Replies retrieved successfully',
        data: mockReplies.data,
        metadata: mockReplies.metadata,
      });
    });

    it('should return empty array when post has no replies', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockReplies = {
        data: [],
        metadata: {
          totalItems: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      postService.getRepliesOfPost.mockResolvedValue(mockReplies);

      const result = await controller.getPostReplies(postId, page, limit, mockUser);

      expect(result.data).toEqual([]);
    });
  });

  describe('toggleRepost', () => {
    it('should repost a post', async () => {
      const postId = 1;
      const mockResult = { reposted: true, message: 'Post reposted' };

      repostService.toggleRepost.mockResolvedValue(mockResult);

      const result = await controller.toggleRepost(postId, mockUser);

      expect(repostService.toggleRepost).toHaveBeenCalledWith(postId, mockUser.id);
      expect(result).toEqual({
        status: 'success',
        message: 'Post reposted',
        data: mockResult,
      });
    });

    it('should unrepost a post', async () => {
      const postId = 1;
      const mockResult = { reposted: false, message: 'Post unreposted' };

      repostService.toggleRepost.mockResolvedValue(mockResult);

      const result = await controller.toggleRepost(postId, mockUser);

      expect(repostService.toggleRepost).toHaveBeenCalledWith(postId, mockUser.id);
      expect(result).toEqual({
        status: 'success',
        message: 'Post unreposted',
        data: mockResult,
      });
    });
  });

  describe('getPostReposters', () => {
    it('should get list of users who reposted a post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockReposters = [
        {
          id: 1,
          username: 'user1',
          verified: false,
          name: 'User One',
          profileImageUrl: 'https://example.com/user1.jpg',
        },
        {
          id: 2,
          username: 'user2',
          verified: true,
          name: 'User Two',
          profileImageUrl: null,
        },
      ];

      repostService.getReposters.mockResolvedValue(mockReposters);

      const result = await controller.getPostReposters(postId, page, limit, mockUser);

      expect(repostService.getReposters).toHaveBeenCalledWith(postId, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Reposters retrieved successfully',
        data: mockReposters,
      });
    });

    it('should return empty array when no reposters', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      repostService.getReposters.mockResolvedValue([]);

      const result = await controller.getPostReposters(postId, page, limit, mockUser);

      expect(result.data).toEqual([]);
    });
  });

  describe('getUserLikedPosts', () => {
    it('should get posts liked by a user', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockLikedPosts = {
        data: [
          {
            userId: 2,
            username: 'otheruser',
            verified: false,
            name: 'Other User',
            avatar: null,
            postId: 1,
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
            text: 'Liked post',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        ],
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      likeService.getLikedPostsByUser.mockResolvedValue(mockLikedPosts);

      const result = await controller.getUserLikedPosts(userId, page, limit);

      expect(likeService.getLikedPostsByUser).toHaveBeenCalledWith(userId, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Liked posts retrieved successfully',
        data: mockLikedPosts.data,
        metadata: mockLikedPosts.metadata,
      });
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      const postId = 1;

      postService.deletePost.mockResolvedValue(undefined);

      const result = await controller.deletePost(postId);

      expect(postService.deletePost).toHaveBeenCalledWith(postId);
      expect(result).toEqual({
        status: 'success',
        message: 'Post deleted successfully',
      });
    });

    it('should throw error if post not found', async () => {
      const postId = 999;

      postService.deletePost.mockRejectedValue(new Error('Post not found'));

      await expect(controller.deletePost(postId)).rejects.toThrow('Post not found');
    });
  });

  describe('getPostsMentioned', () => {
    it('should get posts where user is mentioned', async () => {
      const userId = 1;
      const page = 1;
      const limit = 10;

      const mockMentionedPosts = {
        data: [
          {
            userId: 2,
            username: 'otheruser',
            verified: false,
            name: 'Other User',
            avatar: null,
            postId: 1,
            parentId: null,
            type: 'POST',
            date: new Date(),
            likesCount: 5,
            retweetsCount: 2,
            commentsCount: 1,
            isLikedByMe: false,
            isFollowedByMe: false,
            isRepostedByMe: false,
            isMutedByMe: false,
            isBlockedByMe: false,
            text: 'Post mentioning @testuser',
            media: [],
            mentions: [{ id: 1, username: 'testuser' }],
            isRepost: false,
            isQuote: false,
          },
        ],
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mentionService.getMentionedPosts.mockResolvedValue(mockMentionedPosts);

      const result = await controller.getPostsMentioned(userId, page, limit);

      expect(mentionService.getMentionedPosts).toHaveBeenCalledWith(userId, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Mentioned posts retrieved successfully',
        data: mockMentionedPosts.data,
        metadata: mockMentionedPosts.metadata,
      });
    });
  });

  describe('getMentionsInPost', () => {
    it('should get users mentioned in a post', async () => {
      const postId = 1;
      const page = 1;
      const limit = 10;

      const mockMentions = [
        {
          id: 2,
          username: 'user2',
          is_verified: false,
          Profile: {
            name: 'User Two',
            profile_image_url: null,
          },
        },
        {
          id: 3,
          username: 'user3',
          is_verified: true,
          Profile: {
            name: 'User Three',
            profile_image_url: 'https://example.com/user3.jpg',
          },
        },
      ];

      mentionService.getMentionsForPost.mockResolvedValue(mockMentions);

      const result = await controller.getMentionsInPost(postId, page, limit);

      expect(mentionService.getMentionsForPost).toHaveBeenCalledWith(postId, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Mentions retrieved successfully',
        data: mockMentions,
      });
    });
  });

  describe('getProfilePosts', () => {
    it('should get authenticated user profile posts', async () => {
      const page = 1;
      const limit = 10;

      const mockPosts = {
        data: [
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
            retweetsCount: 2,
            commentsCount: 1,
            isLikedByMe: false,
            isFollowedByMe: false,
            isRepostedByMe: false,
            isMutedByMe: false,
            isBlockedByMe: false,
            text: 'My post',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        ],
        metadata: {
          totalItems: 1,
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 10,
        },
      };

      postService.getUserPosts.mockResolvedValue(mockPosts);

      const result = await controller.getProfilePosts(page, limit, mockUser);

      expect(postService.getUserPosts).toHaveBeenCalledWith(mockUser.id, mockUser.id, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Posts retrieved successfully',
        data: mockPosts.data,
        metadata: mockPosts.metadata,
      });
    });
  });

  describe('getProfileReplies', () => {
    it('should get authenticated user profile replies', async () => {
      const page = 1;
      const limit = 10;

      const mockReplies = {
        data: [
          {
            userId: 1,
            username: 'testuser',
            verified: false,
            name: 'Test User',
            avatar: null,
            postId: 2,
            parentId: 1,
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
            text: 'My reply',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        ],
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      postService.getUserReplies.mockResolvedValue(mockReplies);

      const result = await controller.getProfileReplies(page, limit, mockUser);

      expect(postService.getUserReplies).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.id,
        page,
        limit,
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Replies retrieved successfully',
        data: mockReplies.data,
        metadata: mockReplies.metadata,
      });
    });
  });

  describe('getUserPosts', () => {
    it('should get posts for a specific user', async () => {
      const userId = 2;
      const page = 1;
      const limit = 10;

      const mockPosts = {
        data: [
          {
            userId: 2,
            username: 'otheruser',
            verified: false,
            name: 'Other User',
            avatar: null,
            postId: 1,
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
            text: 'Other user post',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        ],
        metadata: {
          totalItems: 1,
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 10,
        },
      };

      postService.getUserPosts.mockResolvedValue(mockPosts);

      const result = await controller.getUserPosts(userId, page, limit, mockUser);

      expect(postService.getUserPosts).toHaveBeenCalledWith(userId, mockUser.id, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Posts retrieved successfully',
        data: mockPosts.data,
        metadata: mockPosts.metadata,
      });
    });
  });

  describe('getUserReplies', () => {
    it('should get replies for a specific user', async () => {
      const userId = 2;
      const page = 1;
      const limit = 10;

      const mockReplies = {
        data: [
          {
            userId: 2,
            username: 'otheruser',
            verified: false,
            name: 'Other User',
            avatar: null,
            postId: 5,
            parentId: 1,
            type: 'REPLY',
            date: new Date(),
            likesCount: 2,
            retweetsCount: 0,
            commentsCount: 0,
            isLikedByMe: false,
            isFollowedByMe: true,
            isRepostedByMe: false,
            isMutedByMe: false,
            isBlockedByMe: false,
            text: 'Other user reply',
            media: [],
            mentions: [],
            isRepost: false,
            isQuote: false,
          },
        ],
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      postService.getUserReplies.mockResolvedValue(mockReplies);

      const result = await controller.getUserReplies(userId, page, limit, mockUser);

      expect(postService.getUserReplies).toHaveBeenCalledWith(userId, mockUser.id, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Replies retrieved successfully',
        data: mockReplies.data,
        metadata: mockReplies.metadata,
      });
    });
  });

  describe('getProfileMedia', () => {
    it('should get authenticated user profile media', async () => {
      const page = 1;
      const limit = 10;

      const mockMedia = {
        data: [
          {
            id: 1,
            user_id: 1,
            post_id: 1,
            media_url: 'https://example.com/image1.jpg',
            type: 'IMAGE',
            created_at: new Date(),
          },
          {
            id: 2,
            user_id: 1,
            post_id: 2,
            media_url: 'https://example.com/video1.mp4',
            type: 'VIDEO',
            created_at: new Date(),
          },
        ],
        metadata: {
          totalItems: 2,
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 10,
        },
      };

      postService.getUserMedia.mockResolvedValue(mockMedia);

      const result = await controller.getProfileMedia(page, limit, mockUser);

      expect(postService.getUserMedia).toHaveBeenCalledWith(mockUser.id, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Media retrieved successfully',
        data: mockMedia.data,
        metadata: mockMedia.metadata,
      });
    });
  });

  describe('getUserMedia', () => {
    it('should get media for a specific user', async () => {
      const userId = 2;
      const page = 1;
      const limit = 10;

      const mockMedia = {
        data: [
          {
            id: 3,
            user_id: 2,
            post_id: 3,
            media_url: 'https://example.com/image2.jpg',
            type: 'IMAGE',
            created_at: new Date(),
          },
        ],
        metadata: {
          totalItems: 1,
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 10,
        },
      };

      postService.getUserMedia.mockResolvedValue(mockMedia);

      const result = await controller.getUserMedia(userId, page, limit);

      expect(postService.getUserMedia).toHaveBeenCalledWith(userId, page, limit);
      expect(result).toEqual({
        status: 'success',
        message: 'Media retrieved successfully',
        data: mockMedia.data,
        metadata: mockMedia.metadata,
      });
    });

    it('should return empty array when user has no media', async () => {
      const userId = 3;
      const page = 1;
      const limit = 10;

      const mockMedia = {
        data: [],
        metadata: {
          totalItems: 0,
          currentPage: 1,
          totalPages: 0,
          itemsPerPage: 10,
        },
      };

      postService.getUserMedia.mockResolvedValue(mockMedia);

      const result = await controller.getUserMedia(userId, page, limit);

      expect(result.data).toEqual([]);
    });
  });
});
