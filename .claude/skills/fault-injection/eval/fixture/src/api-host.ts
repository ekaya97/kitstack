import { createMailer } from './mailer.js';

export const apiMailer = createMailer({ host: 'localhost', port: 25 });
