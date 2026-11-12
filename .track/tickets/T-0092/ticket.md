---
id: T-0092
title: "Hoist MCP server logic into SDK with adapter pattern for dev/prod/self-hosted parity"
status: done
priority: high
created: "2026-04-27T10:49:06Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-04-27T21:07:22Z"
labels:
  - architecture
  - sdk
  - mcp-server
  - self-hosting
branch: null
files: []
depends_on: []
---

## Description

## Deferred Loading Constraint (from testing 2026-04-27)

Claude.ai defers the `kit` tool behind `tool_search` due to description length. The LLM only discovers it via BM25 search against the full description text. This means:

- **The first line of the description is the critical discoverability surface.** It must contain kit names, trigger keywords, and a CTA like "Call kit() to see all capabilities."
- **Format:** `"KitStack — N apps, M tools in one surface. crm (contacts, deals, pipeline), expense (VAT, tax, receipts). Call kit() to see all capabilities."`
- **Trigger keywords per kit scale dynamically:** all triggers for ≤5 kits, top 2 for 6-10, top 1 for 10+.
- **All action names must be listed** (no truncation with `...`). Truncation forces a mandatory `kit(id)` discovery call. Listing all actions lets the LLM skip straight to `kit(id, cmd, params)`.
- **`kit_view` at ~300 chars is eagerly loaded.** The deferral threshold appears to be ~300-400 chars.
- Tested against Clay and Apollo — kit was chosen over both for a CRM workflow because trigger keywords and action names (`add_contact`, `add_deal`) signaled write operations that competitors lacked.

The shared `description.ts` in the refactored server is the single most important file for discoverability. It must implement this compact, front-loaded format.

## Context

The MCP protocol handling is currently duplicated across two separate code paths:

- **Production**: `packages/mcp-server/src/router/mcp-protocol.ts` + `kit-handler.ts` — multi-kit, Lambda-based, Turso + DynamoDB
- **Dev**: `packages/sdk/src/runtime/mcp-handler.ts` — single-kit, in-process, local SQLite

These paths have diverged significantly. The recent dynamic `tools/list` work (triggers, instructions, `kit(id, cmd, params)` pattern) had to be implemented twice and manually synchronized. Any future protocol change carries the same risk of divergence.

## Goal

Extract the shared MCP protocol logic into `packages/sdk/src/server/` behind a `KitServerAdapter` interface. Both the production router and the dev server become thin adapter implementations over shared protocol code. This also unlocks a self-hosting option with a Dockerfile.

## Core Abstraction

The protocol layer needs exactly one interface:

```typescript
interface KitServerAdapter {
  resolveUserKits(userId: string): Promise<ResolvedKit[]>;
  executeTool(kitId: string, toolName: string, args: unknown, userId: string): Promise<KitToolResult>;
  executeLoader(kitId: string, viewSlug: string, userId: string): Promise<unknown>;
  getShellHtml(kitId: string): Promise<string>;
}

interface ResolvedKit {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  instructions: string | null;
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  views: Array<{ slug: string; name: string; description: string }>;
}
```

Everything the protocol layer does — dynamic description building, `kit()` routing, `kit_view()` handling, `initialize` with instructions — derives from `resolveUserKits` + the execution methods.

## Target File Structure

```
packages/sdk/src/server/
  ├── index.ts              — createKitServer(adapter, options) → KitServer
  ├── protocol.ts           — MCP JSON-RPC dispatch (initialize, tools/list, tools/call, resources)
  ├── kit-router.ts         — kit() progressive discovery (list, discover, describe, run)
  ├── view-router.ts        — kit_view() routing
  ├── description.ts        — buildDynamicKitDescription, buildKitInstructions (CRITICAL — optimized for deferred tool search)
  ├── types.ts              — KitServerAdapter, ResolvedKit, etc.
  └── transport/
      ├── stdio.ts          — stdin/stdout JSON-RPC
      └── http.ts           — HTTP/SSE endpoint

packages/sdk/src/server/adapters/
  ├── local.ts              — single-kit, in-process (dev server)
  └── multi-local.ts        — multi-kit, in-process (self-hosted)
```

The production adapter stays in `packages/mcp-server/` since it depends on AWS services but implements the same `KitServerAdapter` interface.

## Adapter Implementations

### Dev server (local adapter)
- `resolveUserKits()` → returns the single `KitDefinition` from memory (always "activated")
- `executeTool()` → calls handler directly in-process against local SQLite
- `executeLoader()` → calls `view.loader()` directly
- `getShellHtml()` → generated or read from build output

### Production (platform adapter)
- `resolveUserKits()` → queries Turso `kit_registry` + DynamoDB `user_kit_dbs`, groups by kitId, parses triggers/instructions
- `executeTool()` → fetches user DB credentials from DynamoDB, invokes kit Lambda
- `executeLoader()` → invokes Lambda with loader payload
- `getShellHtml()` → reads from S3/CDN

### Self-hosted (multi-local adapter)
- `resolveUserKits()` → scans kits directory for `manifest.json` files, all kits always activated
- `executeTool()` → dynamically imports kit bundle (`kits/{id}/kit.mjs`), creates SQLite DB at `dbDir/{kitId}.db`, calls handler in-process
- `executeLoader()` → same as executeTool but calls the view loader
- `getShellHtml()` → reads from `kitsDir/{kitId}/shell.html`

## Self-Hosted Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY server.js ./
COPY kits/ ./kits/

VOLUME /data
ENV KITSTACK_TRANSPORT=http \
    KITSTACK_PORT=3001 \
    KITSTACK_DB_DIR=/data \
    KITSTACK_KITS_DIR=./kits \
    KITSTACK_AUTH=none
EXPOSE 3001
CMD ["node", "server.js"]
```

Entry point (`server.js`):

```typescript
import { createKitServer } from "@kitstack/sdk/server";
import { multiLocalAdapter } from "@kitstack/sdk/server/adapters/multi-local";

const server = createKitServer({
  adapter: multiLocalAdapter({
    kitsDir: process.env.KITSTACK_KITS_DIR,
    dbDir: process.env.KITSTACK_DB_DIR,
  }),
  transport: process.env.KITSTACK_TRANSPORT,
  port: parseInt(process.env.KITSTACK_PORT),
  auth: process.env.KITSTACK_AUTH,
});

server.start();
```

Claude Desktop integration:

```json
{
  "mcpServers": {
    "kitstack": {
      "command": "docker",
      "args": ["run", "-i", "-v", "./data:/data", "kitstack/server"],
      "env": { "KITSTACK_TRANSPORT": "stdio" }
    }
  }
}
```

## Implementation Plan

1. **Create `packages/sdk/src/server/types.ts`** — define `KitServerAdapter`, `ResolvedKit`, `KitServer` interfaces
2. **Extract `description.ts`** — move `buildDynamicKitDescription` and `buildKitInstructions` from `kit-handler.ts`. Must implement the compact front-loaded format optimized for deferred tool search (first line = kit names + triggers + CTA, action lines = all actions per kit, no truncation).
3. **Extract `protocol.ts`** — shared MCP JSON-RPC dispatch (initialize, tools/list, tools/call, resources)
4. **Extract `kit-router.ts`** — `kit()` routing logic (list kits, discover actions, describe params, run)
5. **Extract `view-router.ts`** — `kit_view()` routing logic
6. **Create `index.ts`** — `createKitServer()` that wires protocol + transport
7. **Create `adapters/local.ts`** — single-kit adapter (replaces `runtime/mcp-handler.ts` internals)
8. **Refactor `runtime/mcp-handler.ts`** — thin wrapper that creates a local adapter + protocol handler
9. **Create platform adapter** — refactor `mcp-protocol.ts` to use `KitServerAdapter`
10. **Create `adapters/multi-local.ts`** — multi-kit in-process adapter for self-hosting
11. **Add transport layer** — stdio and HTTP transports in `server/transport/`
12. **Dockerfile + server entry point**

## What This Unlocks

- **Single source of truth** for MCP protocol behavior — no more sync issues between dev and prod
- **Self-hosting** with a Dockerfile and env var configuration
- **Testing seam** — test protocol with mock adapter, test adapters independently
- **Future transports** (SSE, Streamable HTTP) added once, available everywhere

## Work Log