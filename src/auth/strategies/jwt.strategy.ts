import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { cookieExtractor } from '../utils/cookie-extractor';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor('accessToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.secret!,
    });
  }
  async validate(payload: AuthJwtPayload) {
    const userId = payload.sub;
    return this.authService.validateUserJwt(userId);
  }
}
