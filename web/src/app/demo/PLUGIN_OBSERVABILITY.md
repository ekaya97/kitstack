# Plugin observability contract

The `/api/demo/observability` endpoint currently returns the existing
metadata-only `events` and `aggregate` fields. The Plugins view derives its
registration and activity rows from those events; it does not create or
persist a second telemetry model.

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

When `plugins` is not returned, the UI uses `plugin.registered` events and
other events with `pluginId` to calculate registration and activity counts.
Kind, version, and status remain `Not reported` unless the API supplies those
fields. No backend changes are part of T-0181.
