# Platform kit v0

The platform kit is KitStack's own read-only dashboard surface. It is a normal
kit: its tools and Views consume a host-provided `platform.data` source plugin
through `KitContext.connectors`.

The source plugin is deliberately structural. A host can adapt the existing
debrief `TelemetryStore`, app/plugin registries, and authz tuple store without
making this kit depend on debrief internals. Every source method receives the
request context and must enforce organization, app, and team scope before
returning data.

## Views

- `overview` — sessions, cost, errors, and registry counts.
- `usage-finops` — metadata-only proxy/runtime events, tokens, latency, and cost.
- `registry` — registered apps, kits, plugins, and provider health.
- `grants` — the grant view for operators; it requires `platform:admin` in
  addition to telemetry access.

The Views use the existing SDK View host (`loader` + `component`) and are
compatible with the current chat/View host. Shell navigation and publishing
remain T-0134; this ticket does not rewrite the debrief kit, `/demo`, or SDK
dispatch.

## Host binding follow-up

The kit is intentionally not coupled to a concrete deployment. The router or
platform shell must register `createPlatformDataSource(...)` as the
`platform.data` connector and pass the authenticated `KitContext`. That
integration is the follow-up needed to replace the current `/demo` proof
screens with these Views in a deployed shell.

The current repository does not yet expose durable connector bindings, deploy
queue records, policy-decision records, per-tool struggle aggregates, or audit
export status in the demo snapshot. Those are intentionally not fabricated by
this v0 slice; they remain follow-up platform source fields and Views after the
corresponding G2 contracts land. The existing event stream already supports
proxy usage, runtime observability, trace metadata, and estimated cost.
