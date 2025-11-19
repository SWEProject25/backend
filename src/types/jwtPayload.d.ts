export type AuthJwtPayload = {
  sub: number;
  username: string;
  email?: string;
  profileImageUrl?: string | null;
  name?: string;
  role?: string;
};
