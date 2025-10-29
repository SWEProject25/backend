import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleOauthConfig from '../config/google-oauth.config';
import { ConfigType } from '@nestjs/config';
import { Services } from 'src/utils/constants';
import { AuthService } from '../auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private readonly googleOauthConfiguration: ConfigType<typeof googleOauthConfig>,
    @Inject(Services.AUTH)
    private readonly authService: AuthService,
  ) {
    super({
      clientID: googleOauthConfiguration.clientID!,
      clientSecret: googleOauthConfiguration.clientSecret!,
      callbackURL: googleOauthConfiguration.callbackURL,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const googleName = profile.displayName;
    const email = profile.emails![0].value;
    const createUserDto: CreateUserDto = {
      name: googleName,
      email,
      password: '',
      birthDate: new Date(), // to be modified
    };
    const user = await this.authService.validateGoogleUser(createUserDto);
    done(null, user);
  }
}
