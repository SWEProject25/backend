export type AuthJwtPayload = {
  sub: number;
  id?: number;
  username: string;
  email?: string;
  profileImageUrl?: string | null;
  name?: string;
  role?: string;
};
