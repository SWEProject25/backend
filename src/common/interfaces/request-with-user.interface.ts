import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    sub: number; //userId
    username: string;
    email?: string;
    role?: string;
    name?: string;
    profileImageUrl?: string;
  };
}
