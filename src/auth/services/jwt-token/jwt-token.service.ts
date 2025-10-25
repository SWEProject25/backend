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

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: ms(expiresIn),
    };

    res.cookie('access_token', accessToken, cookieOptions);
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('access_token');
  }
}
