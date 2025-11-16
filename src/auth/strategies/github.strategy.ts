import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { ConfigType } from '@nestjs/config';
import { Services } from 'src/utils/constants';
import { AuthService } from '../auth.service';
import githubOauthConfig from '../config/github-oauth.config';
import { VerifiedCallback } from 'passport-jwt';
import { OAuthProfileDto } from '../dto/oauth-profile.dto';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    @Inject(githubOauthConfig.KEY)
    private readonly githubOauthConfiguration: ConfigType<typeof githubOauthConfig>,
    @Inject(Services.AUTH)
    private readonly authService: AuthService,
  ) {
    super({
      clientID: githubOauthConfiguration.clientID!,
      clientSecret: githubOauthConfiguration.clientSecret!,
      callbackURL: githubOauthConfiguration.callbackURL!,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifiedCallback,
  ) {
    const username = profile?.username;
    const userDisplayname = profile.displayName;
    const providerId = profile.id;
    const provider = profile.provider;
    const profileImageUrl = profile?.photos![0].value;
    // Extract email from profile (GitHub returns emails array)
    const email = profile.emails && profile.emails.length > 0 
      ? profile.emails[0].value 
      : undefined;
    const githubUserDto: OAuthProfileDto = {
      username,
      displayName: userDisplayname,
      provider,
      providerId,
      profileImageUrl,
      email,
    };
    const user = await this.authService.validateGithubUser(githubUserDto);
    done(null, user);
  }
}
