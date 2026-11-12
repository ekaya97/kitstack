import { createMailer } from './mailer.js';

export const workerMailer = createMailer({ host: 'localhost', port: 25 });
