import { SmtpClient } from './smtp-client.js';

/** The one place a transport is built. Every host must call this. */
export function createMailer(config: MailerConfig): SmtpClient {
  return new SmtpClient(config);
}

export type MailerConfig = Readonly<{ host: string; port: number }>;
