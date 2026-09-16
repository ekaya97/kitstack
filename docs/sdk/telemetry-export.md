# External telemetry export

KitStack telemetry is metadata-only. The SDK event contract contains identity,
kit/plugin, channel, operation, model/usage, latency, outcome, and trace
correlation fields. Prompts, completions, audio, transcripts, tool arguments,
and tool results are rejected before an exporter is called.

Hosts can send the same event stream to an OTLP/HTTP collector without adding
an OpenTelemetry package to the SDK:

```ts
import { createDemoApp } from "@kitstackco/debrief-kit";

const app = await createDemoApp({
  orgId: "org-demo",
  telemetry: {
    otlp: {
      endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? { authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_HEADERS}` }
        : undefined,
      serviceName: "kitstack-debrief",
    },
  },
});
```

The endpoint must be an `http` or `https` URL and should point at the
collector's OTLP trace route, usually `/v1/traces`. The exporter sends one
OTLP span per stored event. Trace and span IDs are preserved when they are
valid W3C IDs; deterministic SHA-256-derived IDs are used for legacy demo
identifiers that are not valid hex IDs.

Hosts that already install an OpenTelemetry SDK can adapt its span exporter:

```ts
import {
  createOtelTelemetryExporter,
} from "@kitstackco/sdk";
import { createDemoApp } from "@kitstackco/debrief-kit";

const app = await createDemoApp({
  telemetry: {
    exporter: createOtelTelemetryExporter(installedSpanExporter),
  },
});
```

`telemetry.exporter` and `telemetry.otlp` are mutually exclusive. Export
failures do not remove locally persisted events or break `/demo`; hosts can
provide `onTelemetryExportError` to report collector health. The debrief
store is still the source for the demo observability Views, while the
exporter is an asynchronous external copy of the normalized event.

Do not put provider responses or request bodies in custom exporter input. The
SDK validates the event at the boundary and the OTLP serializer copies only
the allowlisted metadata fields.
