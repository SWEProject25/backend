export interface EmailJob {
  recipients: string[] | Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  text?: string;
}
