# KitStack SDK

The framework for building MCP apps. Tools, views, database, and deployment — handled.

## What is a kit?

A kit is a lightweight MCP app that lives behind an AI conversation. A CRM to track contacts and deals. An expense tracker. A decision journal. Small, focused apps that don't warrant a full SaaS product but are too important to forget between conversations.

You write business logic and UI. The SDK handles the MCP protocol, the platform handles infrastructure.

## Quick start

```bash
npx kitstack init my-kit
cd my-kit
npm install
npx kitstack dev
```

## Define a kit

```typescript
import { defineKit, defineTool, kit } from "@kitstack/sdk";
import { z } from "zod";

const addItem = defineTool({
  name: "add_item",
  description: "Add a new item",
  args: z.object({
    name: z.string().describe("Item name"),
  }),
  handler: async (db, args) => {
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
  migrationsDir: resolve(import.meta.dirname, "migrations"),
  instructions: "Help the user manage their items.",
  triggers: ["item", "tracker"],
  tools: [addItem],
});
```

## CLI

| Command | Description |
|---------|-------------|
| `kitstack init <name>` | Scaffold a new kit project |
| `kitstack dev` | Start dev server (relay mode) |
| `kitstack dev --local` | Start local HTTP server (no relay) |
| `kitstack dev --stdio` | Start stdio transport (offline) |
| `kitstack build` | Validate and bundle for deployment |
| `kitstack serve` | Start self-hosted MCP server |
| `kitstack call <tool> [args]` | Execute tools from the command line |
| `kitstack login` | Authenticate with KitStack |

## Result helpers

```typescript
// Write tools — always return IDs for workflow chaining
return kit.result(kit.created(id, "contact", "Contact added."));
return kit.result(kit.updated(id, "deal", "Deal updated."));
return kit.result(kit.deleted(id, "contact", "Contact archived."));

// Batch writes
return kit.result([
  kit.created(contactId, "contact", "Contact added."),
  kit.created(dealId, "deal", "Deal created."),
]);

// Read tools
return kit.text("## Results\n\n| Name | Value |\n...");
return kit.json({ contacts: [...] });

// Errors
return kit.error("Something went wrong.");
return kit.notFound("contact", id);
```

## Self-hosting

```bash
kitstack serve --transport http --port 3001
```

Or with Docker:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci && npx kitstack build
ENV KITSTACK_TRANSPORT=http
ENV KITSTACK_PORT=3001
EXPOSE 3001
CMD ["npx", "kitstack", "serve"]
```

## Documentation

Full documentation at [kitstack.co/docs](https://kitstack.co/docs)

## License

Proprietary. See LICENSE for details.
