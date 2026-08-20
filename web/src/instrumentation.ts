export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { Resource } = await import("sst");
    const { BatchLogRecordProcessor, LoggerProvider } = await import(
      "@opentelemetry/sdk-logs"
    );
    const { OTLPLogExporter } = await import(
      "@opentelemetry/exporter-logs-otlp-http"
    );
    const { logs } = await import("@opentelemetry/api-logs");
    const { resourceFromAttributes } = await import(
      "@opentelemetry/resources"
    );

    const posthogKey = Resource.PosthogKey.value;
    const posthogHost =
      Resource.PosthogHost.value ?? "https://eu.i.posthog.com";

    if (posthogKey) {
      const loggerProvider = new LoggerProvider({
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
      });
      logs.setGlobalLoggerProvider(loggerProvider);
    }
  }
}
