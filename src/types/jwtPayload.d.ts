export type AuthJwtPayload = {
  sub: string;
  username: string;
  email?: string;
  profileImageUrl?: string;
  name?: string;
  role?: string;
};
