export function createScheduler(raw: unknown): { timeoutMs: number } {
  const config = raw as { timeoutMs: number };
  return { timeoutMs: config.timeoutMs };
}
