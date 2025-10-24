import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    sub: string; //userId
    username: string;
    email?: string;
    role?: string;
    name?: string;
    profileImageUrl?: string;
  };
}
