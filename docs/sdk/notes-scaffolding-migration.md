# Scaffolding, Migration, and Auth Adapters -- Dev Notes

Tickets: T-0022 (kitstack init), T-0029 (outreach tools), T-0030 (outreach views), T-0037 (auth adapters), T-0017 (loader testing), T-0011 (router cleanup)

## What was built

### `kitstack init` scaffolder (T-0022)

The `init` command at `packages/sdk/src/cli/commands/init.ts` creates a complete, runnable kit project from templates. Running `kitstack init my-kit` produces:

```
my-kit/
  kit.config.ts          # defineKit() wiring everything together
  package.json           # deps: @kitstack/sdk, zod, drizzle-orm
  tsconfig.json          # ESNext + bundler resolution + JSX
  tailwind.config.ts     # KitStack preset for view styling
  src/schema.ts          # Drizzle table definition (items)
  src/migrations.ts      # Raw SQL migration string
  src/instructions.ts    # LLM system prompt
  src/tools/example.ts   # defineTool() with load + handler
  src/views/dashboard/   # defineView() with loader + View.tsx
  test/tools.test.ts     # vitest + createTestKit() test
  .gitignore
```

Key decisions:

- **Kit name validation is strict kebab-case.** The regex `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` rejects uppercase, underscores, leading digits, and trailing hyphens. This matches the `id` field convention used in kit.config.ts and the relay's routing.

- **Templates are inline string functions, not file copies.** Each template is a function returning a string (e.g. `kitConfigTemplate(id, displayName)`). This avoids a `templates/` asset directory that would need to survive bundling and npm packaging. The trade-off is that template authoring is less ergonomic (template literals inside TypeScript), but it keeps the CLI self-contained.

- **The example tool has a shared `load` function.** The generated `example.ts` extracts the DB query into a `loadItems()` function used by both the tool `handler` and the dashboard `loader`. This demonstrates the SDK's data-reuse pattern from day one -- the same query powers the tool response and the view.

- **Display name conversion**: `"my-crm-kit"` becomes `"My CRM Kit"` via split-on-hyphen capitalization. Used in `kit.config.ts` `name` field and the instructions template.

### Outreach kit migration (T-0029, T-0030)

The cold-outreach kit at `kits/outreach/` was the first real-world migration from the framework pattern to the SDK. It has 11 tools and 3 views:

**Tools:** `list_sequences`, `create_sequence`, `delete_sequence`, `update_sequence`, `add_prospect`, `remove_prospect`, `set_prospect_hooks`, `edit_email`, `delete_email`, `add_emails`, `export_sequence`

**Views:** `sequence-builder`, `prospect-list`, `email-preview`

Each tool follows the pattern established in the SDK:

```typescript
const listSequencesArgs = z.object({
  status: z.enum(["draft", "active", "paused", "archived"]).optional()
    .describe("Filter by status. If omitted, returns all sequences."),
  limit: z.number().optional().default(25)
    .describe("Max sequences to return (default 25)"),
});

export const listSequences = defineTool({
  name: "list_sequences",
  description: "List all outreach sequences.",
  args: listSequencesArgs,
  load: loadSequences,     // shared query, reused by views
  handler: async (db, args, ctx) => { /* format result for LLM */ },
});
```

Views use the standard three-file layout (`index.ts`, `loader.ts`, `View.tsx`) with the loader importing the tool's `load` function to avoid duplicating queries.

### Auth adapter interface (T-0037)

The `AuthAdapter` interface at `packages/sdk/src/server/auth/adapter.ts` defines the pluggable authentication contract for self-hosted kits. It covers the full OAuth 2.0 lifecycle:

| Method | Purpose |
|--------|---------|
| `metadata()` | Returns `OAuthServerMetadata` for `/.well-known/oauth-authorization-server` |
| `authorize(req)` | Handles authorization requests, returns redirect URL |
| `token(req)` | Exchanges auth codes for access/refresh tokens |
| `revoke(req)` | Revokes a previously issued token |
| `validate(token)` | Validates bearer tokens, returns `{ userId }` or `null` |

The `none()` adapter (`packages/sdk/src/server/auth/none.ts`) is the no-op implementation for local dev. It always validates successfully and returns a fixed user ID (`"local-dev-user"` by default, overridable via `none({ userId: "..." })`).

### Loader testing patterns (T-0017)

Loader functions are tested via `createTestKit()` from `@kitstack/sdk/testing`. The test kit provides an in-memory SQLite database with migrations applied, so loaders can be invoked directly:

```typescript
const testKit = await createTestKit(kit);

// Call a tool (exercises the handler, not the loader)
const result = await testKit.call("list_sequences", { status: "draft" });

// Reset DB state between tests
await testKit.reset();
```

The `load` function on each tool is a plain async function `(db, args, ctx) => data` that can also be called directly in tests when you want to assert on the raw data shape rather than the formatted tool response.

## What was learned

### Migrating from framework to SDK

**The `src/sdk.ts` re-export shim.** During monorepo development, kits can't `import from "@kitstack/sdk"` because the package isn't published. The outreach kit uses a local `src/sdk.ts` that re-exports from the relative path `../../../packages/sdk/src/index`. This works but it means kit source has a different import path than what the scaffolder generates (`@kitstack/sdk`). When we publish the SDK, each kit replaces this shim with the real import.

**The `load` / `handler` split is the key migration insight.** In the old framework, tools returned formatted text directly. The SDK separates data loading (`load`) from presentation (`handler`). This split was the biggest change during migration -- every tool needed its query extracted into a standalone function. The payoff is that views can reuse those queries through `tool.load(db, args, ctx)`.

**Schema and migrations must stay in sync manually.** The Drizzle schema (`src/schema.ts`) and the raw SQL migration string (`src/migrations.ts`) define the same tables but in different languages. There's no codegen to keep them aligned. During the outreach migration we caught a mismatch where the Drizzle schema had a `DEFAULT 'draft'` but the SQL migration was missing it. Both files must be reviewed together.

**Zod `.describe()` on every field matters.** Claude uses these descriptions to understand what each argument does. During outreach migration, we found that generic field names like `id` without a description led to Claude passing the wrong entity's ID (e.g. a prospect ID where a sequence ID was expected). Adding `.describe("The sequence ID to delete")` fixed the issue.

### Template decisions in `kitstack init`

**No interactive prompts.** The scaffolder is intentionally non-interactive -- `kitstack init my-kit` creates everything in one shot. This keeps it scriptable and avoids a dependency on a prompt library. If we need interactive configuration later (e.g., "include auth adapter?"), we can add a `--interactive` flag.

**The generated test uses top-level `await`.** The test template calls `const testKit = await createTestKit(kit)` at module scope. This requires `vitest` with ESM support, which is the default for `type: "module"` packages. It caught us off guard initially because the older vitest docs showed `beforeAll` patterns, but top-level await is cleaner.

### Auth adapter edge cases

**The `none()` adapter's `metadata()` returns `http://localhost` URLs.** This is fine for `kitstack dev --stdio` where no HTTP server is involved, but if someone accidentally uses `none()` with a real HTTP server, MCP clients will try to hit `http://localhost/oauth/authorize` and get confused. We should add a warning log when `none()` is used with `serve()` in non-dev mode.

**`validate()` returns `null` not throws.** The interface was initially designed with `validate()` throwing on invalid tokens. We changed it to return `null` because the server layer needs to distinguish "invalid token" (401) from "adapter crashed" (500). Throwing conflated both cases.

## How to use it

### `kitstack init` workflow

```bash
# 1. Scaffold
npx kitstack init cold-outreach

# 2. Install dependencies
cd cold-outreach
npm install

# 3. Run tests (validates the generated code compiles and runs)
npm test

# 4. Start dev server for Claude Desktop
npx kitstack dev --stdio

# 5. Connect Claude Desktop:
#    Settings > MCP Servers > Add > stdio
#    Command: npx kitstack dev --stdio
#    Working directory: /path/to/cold-outreach
```

The generated kit is immediately functional -- the example tool and dashboard view work out of the box.

### Auth adapter usage

For local development (the default):

```typescript
import { serve } from "@kitstack/sdk/server";
import { none } from "@kitstack/sdk/server/auth";
import kit from "./kit.config";

serve(kit, { auth: none() });
```

For tests with a specific user identity:

```typescript
import { none } from "@kitstack/sdk/server/auth";

const adapter = none({ userId: "test-user-42" });
const result = await adapter.validate("any-token");
// { userId: "test-user-42" }
```

To implement a custom adapter (e.g., wrapping BetterAuth or an external OAuth provider):

```typescript
import type { AuthAdapter, OAuthServerMetadata } from "@kitstack/sdk/server/auth";

function betterAuth(config: { issuer: string; /* ... */ }): AuthAdapter {
  return {
    metadata(): OAuthServerMetadata {
      return {
        issuer: config.issuer,
        authorization_endpoint: `${config.issuer}/oauth/authorize`,
        token_endpoint: `${config.issuer}/oauth/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      };
    },
    async authorize(req) { /* redirect to consent screen */ },
    async token(req) { /* exchange code for tokens */ },
    async revoke(req) { /* invalidate token */ },
    async validate(token) { /* return { userId } or null */ },
  };
}
```

### Loader testing pattern

The recommended way to test a tool's data loading is through `createTestKit`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createTestKit } from "@kitstack/sdk/testing";
import kit from "../kit.config";

describe("outreach tools", () => {
  const testKit = await createTestKit(kit);

  afterEach(async () => {
    await testKit.reset();
  });

  it("lists sequences (empty)", async () => {
    const result = await testKit.call("list_sequences", {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No sequences found");
  });

  it("creates and lists a sequence", async () => {
    await testKit.call("create_sequence", {
      name: "Q2 Launch",
      targetPersona: "Engineering managers",
      tone: "professional",
    });
    const result = await testKit.call("list_sequences", {});
    expect(result.content[0].text).toContain("Q2 Launch");
  });
});
```

For testing the raw loader output (without text formatting), import the tool's `load` function directly:

```typescript
import { listSequences } from "../src/tools/list-sequences";

// testKit.db gives you the LibSQLDatabase instance
const data = await listSequences.load(testKit.db, { limit: 10 }, testKit.ctx);
expect(data).toEqual([]); // raw row objects
```
