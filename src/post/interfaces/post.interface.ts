interface Media {
  media_url: string;
  type: string;
}

interface UserProfile {
  name: string;
  profile_image_url: string | null;
}

interface User {
  id: number;
  username: string;
  is_verified: boolean;
  Profile: UserProfile | null;
  Followers?: { followerId: number }[];
  Muters?: { muterId: number }[];
  Blockers?: { blockerId: number }[];
}

export interface RepostedPost {
    userId: number;
    username: string;
    verified: boolean;
    name: string;
    avatar: string | null;
    isFollowedByMe: boolean;
    isMutedByMe: boolean;
    isBlockedByMe: boolean;
    date: Date;
    originalPostData: TransformedPost;
}

interface Count {
  likes: number;
  repostedBy: number;
}

export interface RawPost {
  id: number;
  user_id: number;
  content: string | null;
  type: string;
  parent_id: number | null;
  visibility: string;
  created_at: Date;
  is_deleted: boolean;
  summary?: string | null;
  _count: Count;
  quoteCount: number;
  replyCount: number;
  User: User;
  media: Media[];
  likes: { user_id: number }[];
  repostedBy: { user_id: number }[];
  mentions: { user_id: number }[];
}

export interface TransformedPost {
  userId: number;
  username: string;
  verified: boolean;
  name: string;
  avatar: string | null;
  postId: number;
  parentId: number | null;
  type: string;
  date: Date;
  likesCount: number;
  retweetsCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isFollowedByMe: boolean;
  isRepostedByMe: boolean;
  isMutedByMe: boolean;
  isBlockedByMe: boolean;
  text: string | null;
  media: { url: string; type: string }[];
  isRepost: boolean;
  isQuote: boolean;
  originalPostData?: TransformedPost;
}
