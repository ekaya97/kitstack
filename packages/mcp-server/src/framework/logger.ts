/**
 * Structured logger for Lambda functions.
 *
 * Sends logs to PostHog via OpenTelemetry and writes to stdout (CloudWatch).
 * Call `flushLogs()` at the end of each Lambda invocation to ensure
 * batched logs are sent before the function freezes.
 *
 * Usage:
 *   import { log, flushLogs } from "../framework/logger";
 *   log.info("Tool dispatched", { userId, toolName });
 *   // ... at end of handler:
 *   await flushLogs();
 */

import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { resource } from "./resource";

const posthogKey: string | undefined = resource("PosthogKey")?.value || undefined;
const posthogHost: string = resource("PosthogHost")?.value ?? "https://eu.i.posthog.com";

let _provider: LoggerProvider | null = null;

function getProvider(): LoggerProvider | null {
  if (!posthogKey) return null;
  if (!_provider) {
    _provider = new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "kitstack-mcp" }),
      processors: [
        new BatchLogRecordProcessor(
          new OTLPLogExporter({
            url: `${posthogHost}/i/v1/logs`,
            headers: {
              Authorization: `Bearer ${posthogKey}`,
              "Content-Type": "application/json",
            },
          })
        ),
      ],
    });
  }
  return _provider;
}

type Attrs = Record<string, string | number | boolean | undefined>;

function emit(
  severityText: string,
  severityNumber: SeverityNumber,
  body: string,
  attrs?: Attrs
) {
  // Always write to stdout for CloudWatch
  const entry = { level: severityText, msg: body, ...attrs, ts: new Date().toISOString() };
  process.stdout.write(JSON.stringify(entry) + "\n");

  // Send to PostHog via OTel
  const provider = getProvider();
  if (!provider) return;
  const logger = provider.getLogger("kitstack-mcp");
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
  const provider = getProvider();
  if (provider) {
    await provider.forceFlush();
  }
}
