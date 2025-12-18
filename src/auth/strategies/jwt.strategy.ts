import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { cookieExtractor } from '../utils/cookie-extractor';
import { Services } from 'src/utils/constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    @Inject(Services.AUTH)
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor('access_token')]),
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.secret as string,
    });
  }

  async validate(payload: AuthJwtPayload) {
    const userId = payload.sub;
    const user = await this.authService.validateUserJwt(userId);
    const result = user;
    return result;
  }
}
