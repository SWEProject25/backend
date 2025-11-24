import { registerAs } from '@nestjs/config';

export default registerAs('googleOAuth', () => ({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_SECRET_KEY,
  callbackURL:
    process.env.NODE_ENV === 'dev'
      ? process.env.GOOGLE_CALLBACK_URL_DEV
      : process.env.GOOGLE_CALLBACK_URL_PROD,
}));
