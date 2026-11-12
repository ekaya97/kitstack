import type { MailerConfig } from './mailer.js';

export class SmtpClient {
  constructor(private readonly config: MailerConfig) {}
  send(to: string, body: string): void {
    void to;
    void body;
  }
}
