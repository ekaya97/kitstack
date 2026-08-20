/**
 * Server-side structured logger for Next.js.
 *
 * Sends logs to PostHog via OpenTelemetry (configured in instrumentation.ts).
 * Also writes to stdout so logs appear in Vercel / CloudWatch.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("Kit activated", { userId, kitSlug });
 *
 * In route handlers, call `flushLogs()` via `after()` to ensure
 * batched logs are sent before the serverless function freezes:
 *
 *   import { after } from "next/server";
 *   import { flushLogs } from "@/lib/logger";
 *   after(() => flushLogs());
 */

import { SeverityNumber, logs } from "@opentelemetry/api-logs";

type Attrs = Record<string, string | number | boolean | undefined>;

function emit(
  severityText: string,
  severityNumber: SeverityNumber,
  body: string,
  attrs?: Attrs
) {
  // Always write to stdout for local dev / platform logs
  const entry = { level: severityText, msg: body, ...attrs, ts: new Date().toISOString() };
  process.stdout.write(JSON.stringify(entry) + "\n");

  // Send to PostHog via OTel if available
  const provider = logs.getLoggerProvider();
  // The no-op provider has no getLogger, skip if not registered
  if (!("getLogger" in provider)) return;
  const logger = provider.getLogger("kitstack-web");
  const cleanAttrs: Record<string, string | number | boolean> = {};
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined) cleanAttrs[k] = v;
    }
  }
  logger.emit({ severityText, severityNumber, body, attributes: cleanAttrs });
}

export const log = {
  debug: (msg: string, attrs?: Attrs) =>
    emit("DEBUG", SeverityNumber.DEBUG, msg, attrs),
  info: (msg: string, attrs?: Attrs) =>
    emit("INFO", SeverityNumber.INFO, msg, attrs),
  warn: (msg: string, attrs?: Attrs) =>
    emit("WARN", SeverityNumber.WARN, msg, attrs),
  error: (msg: string, attrs?: Attrs) =>
    emit("ERROR", SeverityNumber.ERROR, msg, attrs),
};

export async function flushLogs() {
  const provider = logs.getLoggerProvider();
  if ("forceFlush" in provider) {
    await (provider as { forceFlush: () => Promise<void> }).forceFlush();
  }
}
