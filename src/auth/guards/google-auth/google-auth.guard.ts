import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions | undefined {
    const req = context.switchToHttp().getRequest();
    const platform = req.query.platform || 'web';
    return {
      scope: ['profile', 'email'],
      state: platform,
    };
  }
}
