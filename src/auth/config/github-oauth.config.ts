import { registerAs } from '@nestjs/config';

export default registerAs('githubOAuth', () => ({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_SECRET_KEY,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
}));
