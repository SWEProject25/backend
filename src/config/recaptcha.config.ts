import { registerAs } from '@nestjs/config';

export default registerAs('recaptcha', () => ({
  siteKey: process.env.GOOGLE_RECAPTCHA_SITE_KEY,
  secretKey: process.env.GOOGLE_RECAPTCHA_SECRET_KEY,
  minScore: process.env.GOOGLE_RECAPTCHA_MIN_SCORE
    ? parseFloat(process.env.GOOGLE_RECAPTCHA_MIN_SCORE)
    : 0.5,
}));
