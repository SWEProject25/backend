import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override canActivate to make authentication optional
   * Returns true even if authentication fails
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;
  }

  /**
   * Override handleRequest to not throw error on failed auth
   * Returns user if authenticated, null if not
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If no user found, return null instead of throwing error
    // This allows unauthenticated requests to proceed
    return user || null;
  }
}
