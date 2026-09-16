# Storage adapters

KitStack gives kit code a provider-neutral storage capability through
`KitContext.storage`. The host binds it at startup, after resolving provider
credentials. Secrets and provider clients are not part of the kit manifest,
tool arguments, telemetry, or audit records.

```ts
import { defineTool } from "@kitstackco/sdk";

export const listFacts = defineTool({
  name: "list_facts",
  description: "List facts for the current kit",
  args: z.object({}),
  load: async (ctx) => {
    const sql = ctx.storage?.sql;
    if (!sql) throw new Error("This kit requires relational storage");
    return (await sql.execute("SELECT id, value FROM facts ORDER BY id")).rows;
  },
});
```

The contract has two optional capabilities:

- `sql` for provider-neutral parameterized relational queries and batches;
- `objects` for scoped binary objects such as ad screenshots and markup.

Every adapter is bound to an immutable `{ orgId, kitId, tenantId? }` scope.
The host owns credentials and connection lifecycle. An adapter must enforce
that scope on every object operation; relational providers should apply the
same boundary to their implementation-specific query/read model.

The first implementation is `createLibsqlStorageAdapter` in the debrief kit.
It uses the host-created `@libsql/client`, stores objects in a scoped libSQL
table, and is suitable for local development and the current dogfood runtime.
The SDK does not depend on `@libsql/client`, so shared SQL, DynamoDB, and an
external object store can be added without changing kit-facing contracts.

`ctx.db` remains as a compatibility Drizzle binding for maintained kits during
the migration. New kit functions should use `ctx.storage`; the compatibility
field will be removed only after the maintained kits have migrated.
