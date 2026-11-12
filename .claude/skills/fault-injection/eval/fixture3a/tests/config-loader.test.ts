import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config-loader.js';

describe('loadConfig', () => {
  it('accepts a valid config', () => {
    expect(loadConfig({ retries: 2, timeoutMs: 100 })).toEqual({ retries: 2, timeoutMs: 100 });
  });

  it('rejects an unknown key', () => {
    expect(() => loadConfig({ retries: 2, timeoutMs: 100, extra: 1 })).toThrow();
  });
});
