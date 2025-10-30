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

  /**
   * Get the cookie domain from OAuth callback URLs
   * Extract domain from backend URL
   */
  private getCookieDomain(): string | undefined {
    try {
      // Try to get backend URL from OAuth callback URLs
      const backendUrl = process.env.NODE_ENV === 'dev'
        ? process.env.GOOGLE_CALLBACK_URL
        : process.env.GOOGLE_CALLBACK_URL_PROD;
      
      if (!backendUrl) return undefined;

      const url = new URL(backendUrl);
      const hostname = url.hostname;
      
      // For localhost, don't set domain
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return undefined;
      }
      
      // For production subdomains like api.hankers-frontend.myaddr.tools
      // Use .hankers-frontend.myaddr.tools (last 3 parts) because myaddr.tools is on the Public Suffix List
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        return '.' + parts.slice(-3).join('.');
      }
      
      return undefined;
    } catch (error) {
      console.error('Failed to parse cookie domain:', error);
      return undefined;
    }
  }

  public setAuthCookies(res: Response, accessToken: string): void {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as ms.StringValue;
    const cookieDomain = this.getCookieDomain();

    const cookieOptions: any = {
      httpOnly: true,
      sameSite: 'none' as const,
      secure: true,
      maxAge: ms(expiresIn),
      path: '/',
    };

    // Only set domain if we have one (not localhost)
    if (cookieDomain) {
      cookieOptions.domain = cookieDomain;
    }

    console.log('[AUTH] Setting cookie with options:', {
      domain: cookieDomain || 'none (localhost)',
      sameSite: 'none',
      secure: true,
      httpOnly: true,
      path: '/',
      maxAge: cookieOptions.maxAge,
    });

    res.cookie('access_token', accessToken, cookieOptions);
  }

  clearAuthCookies(res: Response): void {
    // Must match the same options used when setting the cookie
    const cookieDomain = this.getCookieDomain();

    const clearOptions: any = {
      path: '/',
      httpOnly: true,
      sameSite: 'none' as const,
      secure: true,
    };

    if (cookieDomain) {
      clearOptions.domain = cookieDomain;
    }

    res.clearCookie('access_token', clearOptions);
  }
}
