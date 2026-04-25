# MCP Handler — Dev Notes

Ticket: T-0024 (MCP JSON-RPC protocol handler)

## What was built

### The handler API

`createMcpHandler(config)` takes a `KitDefinition` + Drizzle `db` and returns an `McpHandler` with three members:

- `handleRequest(req)` — full JSON-RPC 2.0 dispatch (`initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`)
- `callTool(name, args)` — direct tool invocation with Zod validation, bypassing JSON-RPC. Used by view loaders, tests, and internal dispatch.
- `tools` — frozen array of MCP tool definitions

The handler is stateless per-request. All mutable state lives in the database.

### Two-tool split pattern

Instead of registering every kit action as a separate MCP tool (which floods the LLM's context), the handler exposes exactly two tools:

**`kit`** — text-only progressive discovery and CRUD:
```
kit()              → list available actions (markdown table)
kit(cmd)           → describe an action's parameters (JSON Schema)
kit(cmd, params)   → run an action (Zod-validated, then handler)
```

**`kit_view`** — embedded resource rendering for MCP Apps:
```
kit_view()         → list available views
kit_view(view)     → execute loader, return shell HTML + pre-loaded data
```

If a kit has no views, only `kit` is registered. The `kit_view` tool carries `_meta.ui.resourceUri` so Claude.ai knows to render it as an embedded app.

### Tool registration and progressive discovery

The `kit` tool's description includes all action names upfront (`Actions: add_contact, list_contacts, ...`) so the LLM knows what's available without calling `kit()` first. But calling `kit()` gives a richer markdown table with descriptions, and `kit(cmd)` gives full JSON Schema for parameters. This three-level discovery (description → list → describe) keeps the context window lean while still being fully explorable.

### Embedded resources (kit_view)

When `kit_view(view)` is called, the handler:
1. Looks up the view by slug
2. Runs the view's loader to get data
3. Builds a JSON data payload: `{ kit, view, app, data }`
4. Returns two content blocks:
   - `{ type: "text", text: dataPayload }` — the JSON data
   - `{ type: "resource", resource: { uri, mimeType: "text/html;profile=mcp-app", text: shellHtml } }` — the HTML shell

The shell HTML is pre-generated at handler construction time from `shell-template.ts`. It's the same shell for all views in a kit; the `view` slug in the data payload tells the shell which view component to mount.

## What was learned

### JSON-RPC gotchas

- **Notifications return `null`, not an empty response.** A request without an `id` (like `notifications/initialized`) is a notification per JSON-RPC 2.0 spec. `handleRequest` returns `null` for these. The stdio transport must check for `null` and skip writing to stdout. Returning `{ jsonrpc: "2.0", id: null, result: {} }` is wrong — it confuses clients that track request/response pairs.

- **Unknown methods should only error if they have an `id`.** If a client sends a notification with an unknown method, returning an error response violates the spec. The handler checks `isNotification` and returns `null` for unknown notification methods.

- **Error codes matter.** MCP clients (especially Claude Desktop) check error codes to decide retry behavior. We use the standard codes: `-32601` (method not found), `-32602` (invalid params), `-32603` (internal error). Using custom codes can cause clients to abort the session.

### The `__load_view` escape hatch

Views need to reload their data after a tool mutates state (e.g., `add_contact` then the contacts view should refresh). The client-side `useKit().reload()` hook calls `kit(cmd="__load_view", params={ view: "slug" })` to re-run just the loader without re-rendering the full shell. This is handled as a special case in `handleKit` before the normal cmd/params dispatch.

This is a pragmatic hack. It routes through the `kit` tool (text-only) rather than `kit_view` because the view shell is already loaded — we only need fresh data. The response is `{ data: ... }` JSON, not an embedded resource.

### Shell HTML is pre-generated once

`generateShell()` is called at construction time, not per-request. This means changing view config at runtime won't affect the shell. In practice this is fine because kit definitions are immutable after `defineKit()`, but it's worth knowing during development — you need to restart the dev server to pick up view config changes (slug, height, etc.).

### Zod validation happens in `callTool`, not in JSON-RPC dispatch

Argument validation is centralized in `callTool()`, which is called both by the JSON-RPC `tools/call` handler and by direct callers (loaders, tests). This means validation errors are always formatted the same way regardless of entry point. The error format joins Zod issues as `"path: message, path: message"`.

## How to use it

### Basic setup with a real kit

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createMcpHandler } from "@kitstack/sdk/runtime";
import crmKit from "./kit.config";  // CRM kit definition

const client = createClient({ url: "file:.kitstack/dev.db" });
const db = drizzle(client);
await client.execute(crmKit.migrationSql);

const handler = createMcpHandler({ kit: crmKit, db });
```

### handleRequest flow

The typical MCP session looks like this:

```typescript
// 1. Client sends initialize
await handler.handleRequest({
  jsonrpc: "2.0", id: 1, method: "initialize",
});
// → { protocolVersion, serverInfo, capabilities }

// 2. Client sends initialized notification (no response expected)
await handler.handleRequest({
  jsonrpc: "2.0", method: "notifications/initialized",
});
// → null

// 3. Client lists tools
await handler.handleRequest({
  jsonrpc: "2.0", id: 2, method: "tools/list",
});
// → { tools: [{ name: "kit", ... }, { name: "kit_view", ... }] }

// 4. LLM calls kit with progressive discovery
await handler.handleRequest({
  jsonrpc: "2.0", id: 3, method: "tools/call",
  params: { name: "kit", arguments: { cmd: "add_contact", params: { name: "Alice" } } },
});
// → { content: [{ type: "text", text: "Contact \"Alice\" added (ID: ...)" }] }

// 5. LLM shows a view
await handler.handleRequest({
  jsonrpc: "2.0", id: 4, method: "tools/call",
  params: { name: "kit_view", arguments: { view: "contacts" } },
});
// → { content: [{ type: "text", text: "{...json...}" }, { type: "resource", ... }] }
```

### Direct tool calls (tests and loaders)

```typescript
// callTool bypasses JSON-RPC, validates with Zod, returns KitToolResult
const result = await handler.callTool("add_contact", {
  name: "Alice",
  company: "Acme",
});
// result.content[0].text → "Contact \"Alice\" added (ID: abc123)"

// Unknown tool returns isError: true
const err = await handler.callTool("nonexistent", {});
// err.isError → true
// err.content[0].text → "Unknown tool: \"nonexistent\". Available: ..."
```

### Testing pattern (from mcp-handler.test.ts)

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createMcpHandler, type JsonRpcRequest } from "@kitstack/sdk/runtime";
import testKit from "./test-kit";

const client = createClient({ url: ":memory:" });
const db = drizzle(client);
await client.execute("CREATE TABLE IF NOT EXISTS ...");

const handler = createMcpHandler({ kit: testKit, db });

// Helper for concise JSON-RPC calls
async function rpc(method: string, params?: Record<string, unknown>) {
  const req: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method, params };
  return handler.handleRequest(req);
}

// Assert on the result
const res = await rpc("tools/call", {
  name: "kit",
  arguments: { cmd: "list_items", params: {} },
});
```
