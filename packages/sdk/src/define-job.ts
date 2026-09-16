import type { z } from "zod";
import type { JobDefinition, KitContext, KitToolResult } from "./types";
import { KitValidationError } from "./errors";

const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const SCHEDULE_RE = /^(cron|rate)\(\s*[^()]+\s*\)$/;

/**
 * Declare one scheduled unit of work owned by a kit.
 *
 * The first contract deliberately covers only definition-time metadata and
 * execution. Persistence, polling, and lease ownership remain host concerns.
 */
export function defineJob<T extends z.ZodType = z.ZodType>(config: {
  name: string;
  description: string;
  schedule: string;
  timeoutSeconds: number;
  args?: T;
  handler: (ctx: KitContext, args: z.infer<T>) => Promise<KitToolResult | void>;
}): JobDefinition<T> {
  if (!SNAKE_CASE_RE.test(config.name)) {
    throw new KitValidationError(
      "KIT_INVALID_JOB_NAME",
      `Job name "${config.name}" must be snake_case.`,
    );
  }
  if (!config.description || config.description.length < 10) {
    throw new KitValidationError(
      "KIT_SHORT_JOB_DESCRIPTION",
      `Job "${config.name}" description must be at least 10 characters.`,
    );
  }
  if (!SCHEDULE_RE.test(config.schedule)) {
    throw new KitValidationError(
      "KIT_INVALID_JOB_SCHEDULE",
      `Job "${config.name}" schedule must be a cron(...) or rate(...) expression.`,
    );
  }
  if (!Number.isInteger(config.timeoutSeconds) || config.timeoutSeconds <= 0) {
    throw new KitValidationError(
      "KIT_INVALID_JOB_TIMEOUT",
      `Job "${config.name}" timeoutSeconds must be a positive integer.`,
    );
  }

  return { ...config } as JobDefinition<T>;
}
