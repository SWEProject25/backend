// src/auth/utils/oauth-profile.mapper.ts
import {
  GithubProfile,
  GoogleProfile,
} from 'src/common/interfaces/oauth-providers.interface';
import { OAuthProfileDto } from '../dto/oauth-profile.dto';

export function mapGoogleProfile(profile: GoogleProfile): OAuthProfileDto {
  return {
    provider: 'google',
    providerId: profile.id,
    displayName: profile.displayName,
    email: profile.emails?.[0]?.value,
    profileImageUrl: profile.photos?.[0]?.value,
    username: profile.emails?.[0]?.value.split('@')[0], // optional alias
  };
}

export function mapGithubProfile(profile: GithubProfile): OAuthProfileDto {
  return {
    provider: 'github',
    providerId: profile.id.toString(),
    username: profile.username,
    displayName: profile.displayName,
    profileUrl: profile.profileUrl,
    profileImageUrl: profile.photos?.[0]?.value,
  };
}
