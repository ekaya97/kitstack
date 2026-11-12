import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hosts = ['src/api-host.ts', 'src/worker-host.ts'] as const;
const BANNED = 'new SmtpClient(';

describe('host composition', () => {
  it('every host uses the factory and never builds the transport itself', () => {
    for (const host of hosts) {
      const source = readFileSync(new URL(`../${host}`, import.meta.url), 'utf8');
      expect(source, host).toContain('createMailer');
      expect(source, host).not.toContain(BANNED);
    }
  });
});
