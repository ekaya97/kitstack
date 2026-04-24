import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { logs } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";

function getConfig() {
  try {
    const { Resource } = require("sst");
    const R = Resource as any;
    return {
      key: R.PosthogKey?.value || process.env.NEXT_PUBLIC_POSTHOG_KEY,
      host: R.PosthogHost?.value ?? "https://eu.i.posthog.com",
    };
  } catch {
    return {
      key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      host: process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
    };
  }
}

const { key: posthogKey, host: posthogHost } = getConfig();

export const loggerProvider = posthogKey
  ? new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "kitstack-web" }),
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
    })
  : null;

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && loggerProvider) {
    logs.setGlobalLoggerProvider(loggerProvider);
  }
}
