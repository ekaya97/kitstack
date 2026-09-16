# @kitstackco/sdk

The SDK for building kits: MCP applications with typed tools, in-chat views,
versioned instructions, plugins, and a bounded agent loop. You write business
logic and UI. The SDK handles the MCP protocol, the view sandbox, the plugin
contract, and the self-host runtime.

## Quick start

```bash
npx kitstack init my-kit
cd my-kit
npm install
npx kitstack dev
```

## Define a kit

```ts
import { defineKit, defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";

const addItem = defineTool({
  name: "add_item",
  description: "Add a new item",
  args: z.object({
    name: z.string().describe("Item name"),
  }),
  handler: async (db, args, ctx) => {
    const id = nanoid();
    await db.insert(items).values({ id, name: args.name });
    return kit.result(kit.created(id, "item", `Item "${args.name}" added.`));
  },
});

export default defineKit({
  id: "my-kit",
  version: "1.0.0",
  name: "My Kit",
  description: "A simple item tracker",
  schema: {},
  migrationsDir: "./migrations",
  instructions: "Help the user manage their items.",
  triggers: ["item", "tracker"],
  tools: [addItem],
});
```

`handler(db, args, ctx)` receives a typed Drizzle handle, the Zod-parsed
arguments, and a context with the caller identity and kit ID.

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

## CLI

| Command | Description |
|---------|-------------|
| `kitstack init <name>` | Scaffold a new kit project |
| `kitstack dev` | Start the dev server through the relay |
| `kitstack dev --local` | Local HTTP server, no relay |
| `kitstack dev --stdio` | Stdio transport for Claude Code or Desktop |
| `kitstack build` | Validate and bundle tools, Views, and shell |
| `kitstack deploy` | Deploy to the hosted platform |
| `kitstack publish` | Publish built assets |
| `kitstack serve` | Self-hosted MCP server |
| `kitstack call <tool> [args]` | Execute a tool from the command line |
| `kitstack login` | Authenticate with KitStack |

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
import crm from "./kits/crm/kit.config";

serve({
  kits: [crm],
  databases: { crm: { url: process.env.CRM_DB_URL! } },
  transport: "http",
  port: 3001,
  // auth: oauth({ ... })   // none() for local development
});
```

Or `kitstack serve --transport http --port 3001` in a container.

## Documentation

Docs source lives in `web/content/docs/`. The reference implementation of
every primitive above, including a plugin-composed host, is `kits/debrief/`.

## License

KitStack Community License 1.0. See the repository `LICENSE`.
