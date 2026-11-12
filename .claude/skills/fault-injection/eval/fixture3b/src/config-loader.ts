import { z } from 'zod';

const schema = z
  .object({
    retries: z.number().int().min(0),
    timeoutMs: z.number().int().positive(),
  })
  .strict();

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(raw: unknown): AppConfig {
  return schema.parse(raw);
}
