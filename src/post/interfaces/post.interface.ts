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
}

interface Count {
  likes: number;
  repostedBy: number;
  Replies: number;
}

export interface RawPost {
  id: number;
  user_id: number;
  content: string;
  type: string;
  parent_id: number | null;
  visibility: string;
  created_at: Date;
  is_deleted: boolean;
  summary: string | null;
  _count: Count;
  User: User;
  media: Media[];
  likes: { user_id: number; }[];
  repostedBy: { user_id: number; }[];
}

export interface TransformedPost {
  userId: number;
  username: string;
  verified: boolean;
  name: string;
  avatar: string | null;
  postId: number;
  date: Date;
  likesCount: number;
  retweetsCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isFollowedByMe: boolean;
  isRepostedByMe: boolean;
  text: string;
  media: { url: string; type: string }[];
  isRepost: boolean;
  isQuote: boolean;
}
