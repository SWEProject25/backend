import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions | undefined {
    const req = context.switchToHttp().getRequest();
    const platform = req.query.platform || 'web';
    return {
      scope: ['user:email'],
      state: platform,
    };
  }
}
