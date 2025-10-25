export type AuthJwtPayload = {
  sub: number;
  username: string;
  email?: string;
  profileImageUrl?: string;
  name?: string;
  role?: string;
};
