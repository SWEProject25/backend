import { Request } from 'express';
import { AuthJwtPayload } from 'src/types/jwtPayload';

export interface RequestWithUser extends Request {
  user: AuthJwtPayload;
}
