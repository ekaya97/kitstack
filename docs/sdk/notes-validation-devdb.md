# Dev Notes: defineKit Validations, Zod-to-JSON-Schema, and Dev Database Provisioning

Tickets: T-0014 (tool name/description validation), T-0023 (CLI build wiring), T-0025 (two-tool split), T-0027 (dev db provisioning), T-0034 (router registry)

---

## What was built

### defineKit validations (`packages/sdk/src/define-kit.ts`)

`defineKit()` is the top-level entry point for every kit. It accepts the full kit configuration (id, tools, views, schema, migrations) and runs validation before returning the `KitDefinition`.

**Throwing validations (hard errors):**

| Rule | Error class | Error code | Detail |
|------|------------|------------|--------|
| Every tool must have `load()` or `handler()` | `ToolValidationError` | `TOOL_MISSING_IMPL` | Catches tools with no implementation at definition time, not at runtime |
| Tool names must be `snake_case` | `ToolValidationError` | `TOOL_INVALID_NAME` | Regex: `/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/` — suggests a corrected name |
| Tool description must be >= 10 chars | `ToolValidationError` | `TOOL_SHORT_DESCRIPTION` | LLMs need descriptions to decide when to use a tool |
| No duplicate tool names within a kit | `KitValidationError` | `KIT_DUPLICATE_TOOLS` | Lists the duplicated names in the error message |
| View slugs must be `kebab-case` | `KitValidationError` | `KIT_INVALID_VIEW_SLUG` | Regex: `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` — suggests a corrected slug |
| No duplicate view slugs within a kit | `KitValidationError` | `KIT_DUPLICATE_VIEWS` | Lists the duplicated slugs in the error message |

**Non-throwing warnings (console.warn):**

- Tool description is longer than 200 characters
- Tool arg fields are missing `.describe()` (checked via `warnMissingDescribe`)
- Tool name starts with the kit ID as a prefix (e.g. `crm_add_contact` in kit `crm`) — the prefix is added automatically by the runtime

### Zod-to-JSON-Schema converter (`packages/sdk/src/runtime/zod-to-json-schema.ts`)

Converts Zod schemas to JSON Schema for the MCP `tools/list` response. Handles a practical subset of Zod types:

- `ZodObject` -> `{ type: "object", properties, required }`
- `ZodString`, `ZodNumber`, `ZodBoolean` -> primitive types
- `ZodArray` -> `{ type: "array", items }`
- `ZodEnum` -> `{ type: "string", enum: [...] }`
- `ZodRecord` -> `{ type: "object", additionalProperties }`
- `ZodOptional` -> unwraps inner type, omits from `required`
- `ZodDefault` -> unwraps and adds `default` key (evaluates factory functions)
- Unknown types -> falls back to `{ type: "string" }`

All `.describe()` strings are carried through as the `description` property.

### Dev database provisioning (`packages/sdk/src/runtime/dev-db.ts`)

`provisionDevDb()` creates a local SQLite file for `kitstack dev` so developers can iterate without a remote Turso database.

Steps:
1. If `opts.reset` is true and the file exists, delete it
2. Create parent directories with `mkdirSync({ recursive: true })`
3. Connect via `@libsql/client` with `file:` URL
4. Split migration SQL on `;`, trim, filter empty, execute sequentially
5. Return a Drizzle `LibSQLDatabase` instance

---

## What we learned

### snake_case regex gotchas

The regex `/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/` is intentionally strict:

- It rejects leading underscores (`_add_contact` fails) because MCP tool names should be clean identifiers.
- It rejects trailing underscores (`add_contact_` fails).
- It rejects consecutive underscores (`add__contact` fails) because those are almost always typos.
- It rejects uppercase anywhere, including after underscores. This catches `add_Contact` which would be valid in some definitions of snake_case but not ours.
- Pure single-word lowercase names (`list`, `export`) pass — they are valid snake_case.

The same logic applies to the kebab-case regex for view slugs, just with `-` instead of `_`.

When validation fails, `defineKit` attempts to generate a suggested corrected name by converting camelCase boundaries, hyphens, and spaces to the target separator. This is a best-effort suggestion, not guaranteed to be semantically correct.

### Zod type handling edge cases

- **`ZodOptional` vs `ZodDefault`:** Both need unwrapping, but they have different semantics. Optional fields are omitted from the `required` array. Default fields are also omitted from `required` AND get a `default` key in the output. The `default` value might be a literal or a factory function — the converter evaluates factory functions at conversion time.
- **Nested optionals:** `z.string().optional().optional()` is technically valid Zod but unlikely in practice. The converter handles it correctly because `processZodType` recurses.
- **Description propagation:** `.describe()` on any Zod type becomes `{ description }` in the JSON Schema. This is critical for LLM tool usage — without field descriptions, the LLM has to guess what each parameter means.
- **Fallback to string:** Unknown Zod types (unions, intersections, lazy, branded, etc.) fall back to `{ type: "string" }`. This is a pragmatic choice — most MCP clients handle string inputs well, and we can add explicit support for more types as kit developers need them.

### Dev database provisioning

- **Statement splitting:** Splitting on `;` is simple but fragile — it would break on semicolons inside string literals. In practice, migration SQL for kits is machine-generated DDL (CREATE TABLE, CREATE INDEX) that never contains embedded semicolons. If this becomes a problem, we can switch to a proper SQL parser.
- **`IF NOT EXISTS` is auto-injected:** `provisionDevDb()` automatically adds `IF NOT EXISTS` to all `CREATE TABLE` statements at runtime, so drizzle-kit output (which omits it) works without modification. Kit developers don't need to worry about this.
- **File URL format:** libSQL expects `file:` prefix for local databases (e.g. `file:.kitstack/dev.db`). Forgetting the prefix causes a connection error that looks like a network issue, which is confusing.

---

## How to use it

### defineKit with validations

```typescript
// kit.config.ts — standard kit entry point
import { defineKit, defineTool } from "@kitstack/sdk";
import { z } from "zod";

const addContact = defineTool({
  name: "add_contact",                         // must be snake_case
  description: "Add a new contact to the CRM", // must be >= 10 chars
  args: z.object({
    name: z.string().describe("Contact's full name"),  // .describe() avoids warnings
    company: z.string().optional().describe("Company name"),
  }),
  handler: async (db, args, ctx) => {
    // ...
    return kit.text(`Contact "${args.name}" added.`);
  },
});

export default defineKit({
  id: "crm",
  version: "1.0.0",
  name: "CRM Kit",
  description: "Full CRM with contacts, deals, pipeline, and proposals",
  schema,
  migrationSql,
  instructions: crmInstructions,
  tools: [addContact],
  views: [contactsView],  // view slugs must be kebab-case
});
```

If any validation fails, `defineKit` throws immediately with a descriptive error message and a machine-readable error code (e.g. `TOOL_INVALID_NAME`). This means broken kits fail at definition time, not after deployment.

### provisionDevDb for local development

```typescript
import { provisionDevDb } from "@kitstack/sdk/runtime/dev-db";
import { migrationSql } from "./src/migrations";

// Standard usage: creates the DB file and runs migrations
const db = await provisionDevDb(".kitstack/dev.db", migrationSql);

// Reset mode: wipes and recreates the database
const db = await provisionDevDb(".kitstack/dev.db", migrationSql, { reset: true });
```

The returned `db` is a standard Drizzle `LibSQLDatabase` — use it with your Drizzle schema for type-safe queries, or with raw `db.run(sql\`...\`)` for ad-hoc operations.

### Common mistakes

1. **Using camelCase for tool names** — `addContact` will be rejected. Use `add_contact`.
2. **Using snake_case for view slugs** — `contact_detail` will be rejected. Use `contact-detail`.
3. **Forgetting `.describe()` on Zod fields** — won't throw, but the console warning is a signal that LLM performance will suffer.
4. **Short tool descriptions** — "Adds stuff" (10 chars) barely passes. Write descriptions that tell the LLM *when* and *why* to use the tool.
5. **Prefixing tool names with the kit ID** — `crm_add_contact` is wrong if the kit ID is `crm`. Just use `add_contact`; the runtime prefixes automatically.
