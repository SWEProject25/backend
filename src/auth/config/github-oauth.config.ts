import { registerAs } from '@nestjs/config';

export default registerAs('githubOAuth', () => ({
  clientID:
    process.env.NODE_ENV === 'dev'
      ? process.env.GITHUB_CLIENT_ID
      : process.env.GITHUB_CLIENT_ID_PROD,
  clientSecret:
    process.env.NODE_ENV === 'dev'
      ? process.env.GITHUB_SECRET_KEY
      : process.env.GITHUB_SECRET_KEY_PROD,
  callbackURL:
    process.env.NODE_ENV === 'dev'
      ? process.env.GITHUB_CALLBACK_URL
      : process.env.GITHUB_CALLBACK_URL_PROD,
}));
