export type AuthJwtPayload = {
  sub: number;
  username: string;
  name?: string;
  role?: string;
};
