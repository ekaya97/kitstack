import { SmtpClient } from './smtp-client.js';

// Builds the transport directly instead of going through the factory.
export const reportMailer = new SmtpClient({ host: 'localhost', port: 25 });
