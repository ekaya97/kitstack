export function createWorker(raw: unknown): { retries: number } {
  // Reads the same shape, but parses it itself instead of going through loadConfig.
  const config = raw as { retries: number };
  return { retries: config.retries };
}
