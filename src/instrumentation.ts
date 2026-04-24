import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { logs } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { Resource } from "sst";

const posthogKey = Resource.PosthogKey.value || process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = Resource.PosthogHost.value ?? "https://eu.i.posthog.com";

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
