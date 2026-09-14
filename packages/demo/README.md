# Demo runtime storage

This package owns the unreleased sales-agent demo runtime boundary. The
telemetry store uses `@libsql/client` directly and defaults to
`.kitstack/demo.db`; it does not add a SQLite dependency to the SDK and must
not reuse `databases/local.db`.

`src/telemetry` is a metadata-only contract. Events contain identity, channel,
session/tree linkage, operation, model usage, latency, cost, outcome, and
references to memory/instruction versions. The store explicitly inserts only
those columns, so prompts, completions, audio, transcripts, and tool payloads
are not retained.

Use `:memory:` clients in unit tests and `createTelemetryStore({ dbPath })` for
a persistent local demo store. `sequence` is monotonic and query results are
ordered by it, which keeps parent events before their appended children even
when timestamps are equal or arrive out of order.
