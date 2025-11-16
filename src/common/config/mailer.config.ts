import { registerAs } from '@nestjs/config';

export default registerAs('mailer', () => ({
  // Use AWS SES first, fallback to Resend if it fails
  // Set to 'false' to use Resend only (skip AWS SES entirely)
  useAwsFirst: process.env.EMAIL_USE_AWS_FIRST !== 'false', // Default to true
  
  awsSes: {
    smtpHost: process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
    smtpPort: Number.parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10),
    smtpUsername: process.env.AWS_SES_SMTP_USERNAME,
    smtpPassword: process.env.AWS_SES_SMTP_PASSWORD,
    fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@hankers.tech',
    region: process.env.AWS_SES_REGION || 'us-east-1',
  },
  
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@hankers.tech',
  },
  
  azure: {
    connectionString: process.env.AZURE_EMAIL_CONNECTION_STRING,
    fromEmail: process.env.AZURE_EMAIL_FROM,
  },
}));
