import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { Response } from 'express';
import * as ms from 'ms';

@Injectable()
export class JwtTokenService {
  constructor(private readonly jwtService: JwtService) {}

  public async generateAccessToken(userId: number, username: string): Promise<string> {
    const payload: AuthJwtPayload = { sub: userId, username };
    const [accessToken] = await Promise.all([this.jwtService.signAsync(payload)]);
    return accessToken;
  }

  public setAuthCookies(res: Response, accessToken: string): void {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as ms.StringValue;
    const isProduction = process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production';

    const cookieOptions: any = {
      httpOnly: true,
      maxAge: ms(expiresIn),
      path: '/',
    };

    if (isProduction) {
      // Production settings for cross-domain cookies
      cookieOptions.sameSite = 'none';
      cookieOptions.secure = true;
      cookieOptions.domain = '.myaddr.tools';
    } else {
      // Development settings for localhost
      cookieOptions.sameSite = 'lax';
      cookieOptions.secure = false;
      // Don't set domain for localhost
    }

    res.cookie('access_token', accessToken, cookieOptions);
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
  }
}
