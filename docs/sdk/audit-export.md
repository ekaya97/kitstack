# External audit export

The SDK audit contract is metadata-only and hash-chained. Hosts can retain
records locally, export JSON/CSV on demand, or deliver the same SIEM-shaped
records to an HTTP ingestion endpoint:

```ts
import { HashChainedAuditStore, createHttpAuditExporter } from "@kitstackco/sdk";

const audit = new HashChainedAuditStore({
  exporter: createHttpAuditExporter({
    endpoint: process.env.KITSTACK_SIEM_ENDPOINT!,
    headers: { authorization: `Bearer ${process.env.KITSTACK_SIEM_TOKEN}` },
  }),
});
```

Attach the store to the shared dispatch path with the metadata-only adapter.
The organization scope is supplied by the host because dispatch envelopes are
transport-neutral:

```ts
import {
  createDispatchAuditSink,
  dispatch,
} from "@kitstackco/sdk";

await dispatch(envelope, {
  resolve,
  invoke,
  audit: createDispatchAuditSink(audit, {
    orgId: "org-demo",
    appId: "sales-voice",
  }),
});
```

The callback runs for successful calls, provider failures, and every
resolution/grant/policy denial. It receives only identity, routing, session,
outcome, error-code, and latency metadata; arguments and result content are not
part of the callback contract. Router hosts can inject the same sink into
`dispatchToolCall` while retaining the existing structured audit log.

The adapter posts JSON or CSV only after the store has normalized and validated
the event. Prompts, completions, transcripts, audio, tool arguments, payloads,
and results are rejected at the audit boundary. A non-2xx response or timeout
is surfaced to the caller; hosts should add their own retry/queue policy when
the SIEM requires durable delivery guarantees.
