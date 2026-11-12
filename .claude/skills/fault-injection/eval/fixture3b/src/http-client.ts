import { loadConfig } from './config-loader.js';

export function createClient(raw: unknown): { retries: number } {
  const config = loadConfig(raw);
  return { retries: config.retries };
}
