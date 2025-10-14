import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    sub: number; //userId
    name: string;
    email?: string;
    role?: string;
  };
}
