# Plugin observability contract

The `/api/demo/observability` endpoint returns the existing metadata-only
`events` and `aggregate` fields plus a registry snapshot. The Plugins view uses
the snapshot for stable id/kind/version/status labels and the shared events
for registration and activity counts; it does not create or persist a second
telemetry model.

The web response type reserves an optional `plugins` field for a future
backend registry snapshot:

```ts
type PluginDescriptor = {
  id: string;
  kind?: string | null;
  version?: string | null;
  status?: string | null;
  registeredAt?: string | null;
  invocationCount?: number | null;
  lastInvokedAt?: string | null;
  errorCount?: number | null;
};

type ObservabilityResponse = {
  events?: Event[];
  aggregate?: Aggregate;
  plugins?: PluginDescriptor[];
};
```

When `plugins` is not returned, the UI falls back to `plugin.registered` events
and other events with `pluginId` to calculate registration and activity
counts. This keeps the view forward-compatible with hosts that expose only
the shared telemetry stream.
