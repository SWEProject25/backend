import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { AuthJwtPayload } from 'src/types/jwtPayload';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthJwtPayload | undefined, ctx: ExecutionContext) => {
    const request: RequestWithUser = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (data) {
      return user[data];
    }
    return user;
  },
);
