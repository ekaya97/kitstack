# @kitstackco/sdk

The SDK for building kits: MCP applications with typed tools, in-chat views,
versioned instructions, plugins, and a bounded agent loop. You write business
logic and UI. The SDK handles the MCP protocol, the view sandbox, the plugin
contract, and the self-host runtime.

## Quick start

```bash
npx @kitstackco/sdk@latest init my-kit
cd my-kit
npm install
npm test                                    # generate migrations, run the tests
npx kitstack call kit my-kit add_item '{"name":"First item"}'
npx kitstack call kit my-kit list_items '{}'
```

There is no unscoped `kitstack` package: start with `npx @kitstackco/sdk@latest`.
Inside a kit project the binary is `kitstack`, so `npx kitstack <command>` works.

Connect the kit to Claude Code (run inside `my-kit/`):

```bash
claude mcp add my-kit -- npm exec --prefix "$PWD" -- kitstack dev --stdio --config "$PWD/kit.config.ts"
```

For Claude Desktop, which has no `cwd` setting, use absolute paths in
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-kit": {
      "command": "npm",
      "args": ["exec", "--prefix", "/absolute/path/to/my-kit", "--", "kitstack", "dev", "--stdio", "--config", "/absolute/path/to/my-kit/kit.config.ts"]
    }
  }
}
```

If Desktop cannot find `npm` (for example with nvm), use its absolute path as `command`.

## Define a kit

```ts
import { defineKit, defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import * as schema from "./src/schema";
import { items } from "./src/schema";

const addItem = defineTool({
  name: "add_item",
  description: "Add a new item",
  mode: "act",
  args: z.object({
    name: z.string().describe("Item name"),
  }),
  handler: async (ctx, args) => {
    const id = crypto.randomUUID();
    await ctx.db.insert(items).values({ id, name: args.name });
    return kit.result(kit.created(id, "item", `Item "${args.name}" added.`));
  },
});

export default defineKit({
  id: "my-kit",
  version: "1.0.0",
  name: "My Kit",
  description: "A simple item tracker",
  schema,
  migrationsDir: "./migrations",
  instructions: "Help the user manage their items.",
  triggers: ["item", "tracker"],
  tools: [addItem],
});
```

`handler(ctx, args)` receives one request-scoped `KitContext` and the
Zod-parsed arguments. The database is `ctx.db`; identity is available through
`ctx.identity`, with channel/session correlation and telemetry, audit, logging,
and connector seams on the same context. View loaders use `loader(ctx)` and
tool data functions use `load(ctx, args)`.

### Storage adapters

New kit code should use the provider-neutral `ctx.storage` capability. It
exposes optional parameterized SQL and object-store operations, bound by the
host to an `{ orgId, kitId, tenantId? }` scope. The SDK has no database-driver
dependency; hosts resolve credentials and construct the adapter at bind time.
See [`docs/storage-adapters.md`](../../docs/storage-adapters.md) for the
contract and the debrief kit's libSQL implementation. `ctx.db` is retained as
a compatibility Drizzle binding while maintained kits migrate.

## Define an agent

`defineAgent` is a bounded loop scoped to one kit and one trigger. The loop
owns session isolation, turn and wall-clock limits, cancellation, the declared
tool set, and the instruction version. Lifecycle hooks receive names, outcomes,
counts, and durations only.

```ts
import { defineAgent } from "@kitstackco/sdk";

const agent = defineAgent({
  id: "agent:interviewer",
  kitId: "my-kit",
  trigger: { id: "trigger:after-meeting", identity: "service" },
  instructions: { version: "interviewer@1", content },
  turnSource: { next: async ({ session, signal }) => channel.read(signal) },
  model: { turn: async (req) => provider.step(req) },   // returns a message or one tool call
  output: { emit: async ({ content, terminal }) => channel.write(content) },
  tools: [endCall],
  hooks: { onEvent: (event) => telemetry.record(event) },
  maxTurns: 10,
  maxDurationMs: 60_000,
});

const result = await agent.run({ sessionId: "s-1", signal });
```

Events: `run_started`, `turn_started`, `turn_finished`, `tool_called`,
`run_finished`. Result status: `completed`, `cancelled`, `timed_out`,
`max_turns`, `failed`. A model that requests an undeclared tool ends the run
with `AGENT_UNDECLARED_TOOL`.

## Plugins

Host capabilities are plugins with a data-only manifest.

```ts
import { PluginRegistry } from "@kitstackco/sdk";

const registry = new PluginRegistry({ onRegister: (e) => log(e.manifest.id) });
registry.register({
  manifest: { id: "memory:default", kind: "memory", version: "1.0.0", capabilities: ["save", "load"], dependencies: ["persistence:libsql"] },
  invoke: async (input, context) => memory.handle(input, context),
});
```

The registry rejects duplicate IDs, resolves by ID or kind, and passes
`requestId`, `traceId`, `parentId`, and an abort signal to every invocation.

## External telemetry

Hosts can export the SDK's metadata-only telemetry to an existing OTel SDK or
directly to an OTLP/HTTP collector:

```ts
import { createOtlpHttpTelemetryExporter } from "@kitstackco/sdk";

const exporter = createOtlpHttpTelemetryExporter({
  endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
  serviceName: "my-kit",
});
```

The OTLP serializer allowlists the SDK event fields and rejects content-bearing
events before making a request. See [`docs/sdk/telemetry-export.md`](../../docs/sdk/telemetry-export.md)
for wiring the debrief host and handling collector failures.

## CLI

| Command | Description |
|---------|-------------|
| `kitstack init <name>` | Scaffold a new kit project (`npx @kitstackco/sdk@latest init <name>`) |
| `kitstack dev --local` | Local MCP over HTTP on `http://localhost:4567` |
| `kitstack dev --stdio` | MCP over stdio for Claude Code or Desktop |
| `kitstack dev` | Dev server through the KitStack relay (needs `kitstack login`; falls back to local) |
| `kitstack call kit <kit-id> [tool] ['<json>']` | List, describe (no JSON), or run (with JSON) a tool |
| `kitstack build` | Validate and bundle tools, Views, and shell |
| `kitstack serve` | Self-hosted MCP server (`--transport stdio\|http`, HTTP at `http://127.0.0.1:3001/mcp`) |
| `kitstack login` | Authenticate with the hosted KitStack platform |
| `kitstack deploy` | Deploy privately to the hosted platform (needs login) |
| `kitstack grants`, `kitstack connectors bind` | Manage hosted-platform grants and connector bindings (needs login) |

`kitstack dev` and `kitstack call` generate migrations from `src/schema.ts`
into `migrations/` before running; commit that directory. `kitstack publish` is
not available yet.

## Result helpers

```ts
return kit.result(kit.created(id, "contact", "Contact added."));
return kit.result(kit.updated(id, "deal", "Deal updated."));
return kit.result([kit.created(a, "contact", "…"), kit.created(b, "deal", "…")]);
return kit.text("## Results\n\n| Name | Value |\n…");
return kit.json({ contacts: [] });
return kit.error("Something went wrong.");
return kit.notFound("contact", id);
```

## Self-hosting

```ts
import { serve } from "@kitstackco/sdk/server";
import kit from "./kit.config";

await serve({
  kit,
  db: { url: process.env.KITSTACK_DB_URL! },
  transport: "http",
  host: "0.0.0.0",          // default 127.0.0.1
  port: 3001,
  mcpPath: "/mcp",          // default "/"
  authenticate: async (req) => {
    const user = await verifyToken(req.headers.authorization); // your identity provider
    return user ? { userId: user.id } : { status: 401 };
  },
  checkAuthz: async (db, requirement, ctx) => isAllowed(ctx.identity.principal, requirement),
});
```

For local use, `kitstack serve --transport http` serves the kit at
`http://127.0.0.1:3001/mcp` with no code. Self-hosted servers are fail-closed
for tools that declare an `authorize` hook: they are denied unless `checkAuthz`
is passed to `serve()` (or `kitstack serve --unsafe-skip-authz` is used for local
development). `kitstack dev` and `kitstack call` do not enforce `authorize`.
`serve()` does not apply migrations; `kitstack serve` applies the existing ones.

`kitstack build` also emits a generated container context, a single
Compose-compatible `kitstack.yaml` deployment file, and signed artifact
metadata for KitStack's hosting adapters (the container runs the kit's
invocation handler, not an MCP endpoint). See
[`docs/sdk/container-deployment.md`](../../docs/sdk/container-deployment.md)
for local Compose, Fargate, and Kubernetes operation.

## Documentation

Docs source lives in `web/content/docs/`. The reference implementation of
every primitive above, including a plugin-composed host, is `kits/debrief/`.

## License

KitStack Community License 1.0. See the repository `LICENSE`.
