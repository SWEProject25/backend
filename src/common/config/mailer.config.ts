import { registerAs } from '@nestjs/config';

export default registerAs('mailer', () => ({
  azure: {
    connectionString: process.env.AZURE_EMAIL_CONNECTION_STRING,
    fromEmail: process.env.AZURE_EMAIL_FROM,
  },
}));
