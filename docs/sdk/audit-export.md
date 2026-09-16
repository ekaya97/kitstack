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

The adapter posts JSON or CSV only after the store has normalized and validated
the event. Prompts, completions, transcripts, audio, tool arguments, payloads,
and results are rejected at the audit boundary. A non-2xx response or timeout
is surfaced to the caller; hosts should add their own retry/queue policy when
the SIEM requires durable delivery guarantees.
