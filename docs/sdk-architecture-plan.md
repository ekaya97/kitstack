# KitStack SDK — Architecture Plan

## 1. Vision

The KitStack SDK (`@kitstack/sdk`) is the single authoring interface for building kits. It owns the contract: types, validation, error handling, persistence, testing, and local runtime. The production framework (`packages/mcp-server/src/framework/`) becomes a consumer of the SDK — not the other way around.

**Dogfooding principle:** We rebuild our own kits (outreach, CRM, expense, meeting) using the SDK before any third-party developer touches it. If the SDK can't express everything our first-party kits need, it's not ready.

**Deployment model:** Flexible, like SvelteKit adapters.
- **Local development:** `kitstack dev --stdio` (Claude Desktop/Code) or `kitstack dev` (relay for any LLM client)
- **Managed deployment:** Sandboxed Lambda in KitStack's cloud (submitted via `kitstack publish`, proxied DB, IAM-isolated)
- **Self-hosted:** `serve()` — standalone server, container, or monolith. Auth via KitStack identity provider, custom OAuth, or none.
- **Relay:** KitStack provides public URL + auth for self-hosted kits that don't have their own domain

---

## 2. SDK Contract

### 2.1 Core types

```typescript
// --- Context (replaces bare userId string) ---

interface KitContext {
  userId: string;
  kitId: string;
}

// --- Tool definition ---

interface ToolDefinition<TArgs extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  args: TArgs;
  authorize?: (args: z.infer<TArgs>, ctx: KitContext) => AuthzRequirement[];
  handler: (db: LibSQLDatabase, args: z.infer<TArgs>, ctx: KitContext) => Promise<KitToolResult>;
}

// --- View definition (MCP Apps UI) ---

interface ViewDefinition<TLoader extends LoaderFn = LoaderFn> {
  slug: string;                        // URL-safe identifier, e.g. "sequence-builder"
  name: string;                        // Display name, e.g. "Sequence Builder"
  description: string;                 // When to show (surfaced in kit discover output)
  loader: TLoader;                     // Server-side data function → returns typed data
  component: string;                   // Path to React component entry (e.g. "./View.tsx")
  permissions?: {                      // Host permissions for the iframe sandbox
    clipboardWrite?: boolean;          // navigator.clipboard.writeText()
  };
}

// --- Loader (server-side data for views, like SvelteKit's load()) ---

type LoaderFn = (db: LibSQLDatabase, ctx: KitContext) => Promise<unknown>;
type LoaderData<T extends { loader: LoaderFn }> = Awaited<ReturnType<T["loader"]>>;

// --- Kit definition ---

interface KitDefinition {
  id: string;                          // slug, e.g. "cold-outreach"
  name: string;                        // display name
  description: string;
  schema: Record<string, unknown>;     // Drizzle table definitions (for type inference)
  migrationSql: string;                // CREATE TABLE statements
  instructions: string;                // LLM behavioral prompt
  tools: ToolDefinition[];
  views?: ViewDefinition[];            // Optional: interactive UI views
}

// --- Result type (MCP-native) ---

interface KitToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
```

**Key changes from current framework:**
- `handler` receives `(db, args, ctx)` instead of `(db, args)` — `KitContext` provides identity without coupling to infra
- `db` is typed as `LibSQLDatabase` instead of `any` — kit developers get autocomplete on their schema
- `authorize` is an optional declarative hook — the runtime evaluates it before calling `handler`
- `views` on the kit replaces the hardcoded `KIT_APPS` and `VIEW_DATA` maps — the kit declares its own UI surfaces and what data each view needs

### 2.2 Result helpers

Every tool currently constructs `{ content: [{ type: "text", text: "..." }] }` manually. The SDK provides helpers:

```typescript
import { kit } from "@kitstack/sdk";

// Success
return kit.text(`Sequence "${name}" created.`);

// Error
return kit.error("Sequence not found");

// Structured data (JSON block for LLM parsing)
return kit.json({ id, name, status, emailCount: 3 });

// Actionable errors
return kit.notFound("sequence", args.sequenceId);
return kit.validationError("Name must be unique within the sequence");
return kit.conflict("Sequence is archived and cannot be modified");
```

Implementation — these are thin wrappers that return `KitToolResult`:

```typescript
export const kit = {
  text: (text: string): KitToolResult =>
    ({ content: [{ type: "text", text }] }),

  error: (text: string): KitToolResult =>
    ({ content: [{ type: "text", text }], isError: true }),

  json: (data: unknown): KitToolResult =>
    ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }),

  notFound: (entity: string, id: string): KitToolResult =>
    kit.error(`${entity} with id "${id}" not found`),

  validationError: (message: string): KitToolResult =>
    kit.error(`Validation error: ${message}`),

  conflict: (message: string): KitToolResult =>
    kit.error(`Conflict: ${message}`),
};
```

### 2.3 Error system

SDK errors (thrown during kit definition, build, or validation — not tool results) follow a hierarchy with codes and doc links:

```typescript
export class KitStackError extends Error {
  readonly code: string;
  readonly docUrl: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "KitStackError";
    this.code = code;
    this.docUrl = `https://docs.kitstack.dev/errors/${code}`;
  }
}

// Subclasses
export class KitValidationError extends KitStackError { ... }   // Kit definition problems
export class ToolValidationError extends KitStackError { ... }  // Tool definition problems
export class MigrationError extends KitStackError { ... }       // SQL migration failures
export class AuthError extends KitStackError { ... }            // CLI auth failures
```

Error messages are actionable:
- Bad: `"Invalid tool name"`
- Good: `"Tool name 'createContact' must be snake_case. Use 'create_contact' instead."`

### 2.4 Tool description validation

The SDK validates tool quality at definition time (`defineKit()` call) and at build time (`kitstack build`). This is critical for MCP tool quality — bad descriptions produce bad LLM tool use.

**Validations:**

| Rule | Level | Message |
|------|-------|---------|
| Tool description is empty or < 10 chars | Error | `Tool "X" description is too short. Descriptions help the LLM understand when and how to use the tool.` |
| Tool description > 200 chars | Warning | `Tool "X" description is long (N chars). Consider being more concise.` |
| Zod field is missing `.describe()` | Warning | `Tool "X" arg "Y" has no description. Add .describe() to help the LLM fill this field correctly.` |
| Tool name is not snake_case | Error | `Tool name "createContact" must be snake_case. Use "create_contact".` |
| Tool name contains kit ID prefix | Warning | `Tool "outreach_create_sequence" should not include the kit prefix. Use "create_sequence" — the kit context is added automatically.` |
| Duplicate tool names in kit | Error | `Kit "X" has duplicate tool names: Y.` |

**Implementation:** `defineKit()` runs validations and throws `KitValidationError` on errors, logs warnings to stderr. The `kitstack build` command re-runs these plus additional checks (migration SQL validity, Zod schema serialization).

### 2.4.1 Tool output best practices (from dogfooding)

Validated by deploying the CRM kit prototype (SDK-pattern tools) and testing end-to-end with Claude. These are lessons learned, not build-time validations — they belong in documentation and `kitstack init` templates.

**Always include entity IDs in list output.** When a list tool returns entities that other tools reference by ID, the IDs must be visible in the output. Without them, the LLM can't chain operations (e.g., `list_deals` → `update_deal(dealId=...)`). The LLM should never have to call an export tool just to discover IDs.

```typescript
// Bad — LLM can't get the deal ID to pass to update_deal
"| Deal | Stage | Value |\n| Acme Corp | proposal | €50,000 |"

// Good — LLM can read the ID and use it immediately
"| ID | Deal | Stage | Value |\n| `abc123` | Acme Corp | proposal | €50,000 |"
```

**Next-step guidance in write tool output.** After a mutation, tell the LLM what to do next. This creates a natural workflow chain.

```typescript
return kit.text(`Contact "${args.name}" added (ID: ${id}). Next: add_deal to create a deal for this contact.`);
```

**Progressive disclosure works.** The `kit()` → `kit(id)` → `kit(id, cmd)` → `kit(id, cmd, params)` pattern was validated as natural for LLMs. Each response tells the LLM exactly what the next step is. The SDK should generate discover responses that follow this pattern.

**Empty args normalization.** Tools with `args: z.object({})` may receive `undefined` instead of `{}` depending on how the LLM calls them. The runtime should normalize this — treat missing `params` as `{}` for tools that accept no arguments.

### 2.5 AuthZ integration

The `packages/authz` types and engine are re-exported from the SDK so kit authors can declare per-tool authorization:

```typescript
import { defineTool } from "@kitstack/sdk";

export const deleteSequence = defineTool({
  name: "delete_sequence",
  description: "Permanently delete a sequence and all its emails",
  args: z.object({
    sequenceId: z.string().describe("ID of the sequence to delete"),
  }),
  authorize: (args, ctx) => [
    { relation: "owner", objectType: "sequence", objectId: args.sequenceId },
  ],
  handler: async (db, args, ctx) => {
    await db.delete(sequences).where(eq(sequences.id, args.sequenceId));
    return kit.text("Sequence deleted.");
  },
});
```

**Runtime behavior:**
1. If `authorize` is defined, the runtime calls it to get requirements
2. Each requirement is checked via `check(db, { subjectId: ctx.userId, ...requirement })`
3. If any check fails, the tool returns `kit.error("Forbidden: ...")` without calling `handler`
4. If `authorize` is undefined, the tool runs unconditionally (current behavior)

**Current kits don't need this** — each user has an isolated database, so all operations are implicitly authorized. The hook exists for future multi-user kits (team workspaces, shared sequences).

### 2.6 MCP Apps UI

Kits can include interactive views — HTML rendered inside the LLM client as sandboxed iframes via the MCP Apps extension (`io.modelcontextprotocol/ui`). See `docs/mcp-apps.md` for full protocol details.

#### 2.6.1 Architecture: Two-tool split

Claude.ai renders an iframe on **every call** to a tool that has `_meta.ui.resourceUri`. There's no conditional rendering per-call. This forces a two-tool architecture:

- **`kit`** — text-only CRUD tool. No `_meta.ui`. Never renders an iframe.
- **`kit_view`** — rendering tool. Has `_meta.ui.resourceUri`. Always renders an iframe.

The LLM decides when to show UI by choosing between the two tools. Write operations go through `kit` (text-only). When the user wants to see data visually, the LLM calls `kit_view`.

This split is a **platform-level concern** — it lives in the router (`kit-handler.ts`), not in the SDK. Kit developers don't need to know about it. They define tools and views; the router wires them into the two-tool pattern.

#### 2.6.2 Universal app shell + chunked view architecture

KitStack uses a single generic app shell (~8.5KB) stored in S3. The shell has **two rendering paths**:

**React path (CDN available):**
1. Connects to the MCP host via `ui/initialize` postMessage handshake
2. Receives the tool result containing `{ kit, view, cmd, params, cdn }` JSON
3. Sets up `window.__KITSTACK_MCP__` bridge (allows views to call tools via postMessage)
4. Loads shared assets from CloudFront CDN: `vendor.js` (React, 189KB) → `shared.js` (hooks/types, 19KB) → `style.css`
5. Loads the view-specific module: `{cdn}/{kitFolder}/{view}.js`
6. View module auto-registers on `window.__KITSTACK_VIEWS__['{kit}/{view}']` and exports `mount(container)`
7. Shell calls `mount()` → React component renders, fetches data via `mcp.callTool()`

**Markdown fallback (no CDN):**
1. Same postMessage handshake
2. Calls `tools/call` back to the server with the `cmd`/`params` from the JSON payload
3. Renders the markdown response as formatted HTML (tables, headers, lists)

**View modules** are chunked ES builds (via `vite.views.config.ts`):
```
dist-views/
├── vendor.js          # React + ReactDOM (shared across all views)
├── shared.js          # @shared hooks, types, utilities
├── style.css          # Tailwind + app styles
├── crm/
│   ├── pipeline.js    # mount() + __KITSTACK_VIEWS__ registration
│   ├── contacts.js
│   └── ...
├── outreach/
│   ├── sequence-builder.js
│   └── ...
```

Each view module follows this pattern:
```typescript
// src/outreach/email-preview/main.tsx
import { createRoot } from "react-dom/client";
import { EmailPreview } from "./EmailPreview";

export function mount(container: HTMLElement) {
  createRoot(container).render(<EmailPreview />);
}
((window as any).__KITSTACK_VIEWS__ ??= {})["outreach/email-preview"] = { mount };
```

Views call tools via the MCP bridge (no JWT, no HTTP):
```typescript
// Inside a React view component
const mcp = (window as any).__KITSTACK_MCP__;
const result = await mcp.callTool("list_sequences", {});
```

**CSP allowlisting:** Resources include `_meta.ui.csp` so the iframe sandbox allows loading from the CDN:
```typescript
_meta: {
  ui: {
    csp: {
      resourceDomains: [cdnUrl, "fonts.googleapis.com", "fonts.gstatic.com"],
      connectDomains: [cdnUrl],
    },
  },
}
```

The shell has **no kit-specific knowledge**. The server tells it what data to fetch and where to load view modules from.

#### 2.6.3 What the SDK owns

| Currently hardcoded | Moves to |
|---|---|
| `KIT_APPS` — `Record<kitId, KitApp[]>` in `app-resources.ts` | `views` array on `KitDefinition` |
| `VIEW_DATA` — `Record<kitId, Record<view, { cmd, description }>>` in `kit-handler.ts` | `loader` + `description` on `ViewDefinition`. Loader replaces the cmd lookup — the server executes the loader directly instead of dispatching to a tool. |
| `KIT_FOLDER` — `Record<kitId, string>` in `app-resources.ts` | Eliminated (derived from kit ID) |

**What stays in the router:**
- Two-tool split (`kit` + `kit_view` definitions)
- `_meta.ui.resourceUri` on `kit_view` tool definition
- Embedded resource block construction in `kit_view` response
- App shell serving from S3
- postMessage protocol between shell and host

#### 2.6.4 Declaring views in a kit

Views are defined in their own directory and imported into `kit.config.ts`. Each view has a loader (server-side data), a component (client-side React), and metadata:

```typescript
// src/views/sequence-builder/index.ts
import { defineView } from "@kitstack/sdk";
import { loader } from "./loader";

export default defineView({
  slug: "sequence-builder",
  name: "Sequence Builder",
  description: "after creating or editing sequences and emails",
  loader,
  component: "./View.tsx",
});
```

See section 2.7 for the full type-safe loader → component data flow.

**Key design:** Views and tools are decoupled. Tools serve the LLM (text output). Views have their own loaders for typed data. Both can share business logic via a `queries/` layer. The LLM decides when to show a view based on the view's `description`.

#### 2.6.5 How it works end-to-end

**Kit discover (`kit(id="cold-outreach")`):**

The router builds the discover response from the kit registry, including view guidance:

```
**Interactive UI:** `kit_view(id="cold-outreach", view="...")` —
  sequence-builder — after creating or editing sequences and emails;
  prospect-list — after adding prospects or updating hooks;
  email-preview — to review email content before sending
```

This text is generated from `views[].description` in the kit definition. Currently hardcoded in `VIEW_DATA`; after SDK migration, read from the registry.

**View render (`kit_view(id="cold-outreach", view="sequence-builder")`):**

1. Router looks up the view in the registry → finds the view's loader
2. Router executes the loader (in the kit Lambda) → gets typed JSON data
3. Router returns an MCP response with two content blocks:
   - Text block: `{ "view": "sequence-builder", "data": [...] }` (pre-loaded data from the loader)
   - Embedded resource block: the app shell HTML with `mimeType: "text/html;profile=mcp-app"`
4. Claude.ai sees the embedded resource + `_meta.ui.resourceUri` on the tool definition → renders iframe
5. Shell initializes via postMessage, receives the tool result, parses the JSON
6. Shell loads the view component module from CDN, calls `mount()`, passes `data` as props
7. Component renders immediately — no loading state, no additional fetches

Data is pre-loaded by the loader (like SvelteKit's `load()`). The view component receives typed props, not a string to parse. See section 2.7.3 for details.

#### 2.6.6 Validation rules

| Rule | Level | Message |
|------|-------|---------|
| View `loader` is not a function | Error | `View "X" loader must be a function created with defineLoader().` |
| View `slug` is not kebab-case | Error | `View slug "Sequence Builder" must be kebab-case. Use "sequence-builder".` |
| View `component` path doesn't exist (when set) | Error | `View "X" references component "Y" but the file doesn't exist.` |
| Duplicate view slugs | Error | `Kit "X" has duplicate view slugs: Y.` |
| View `description` is empty | Warning | `View "X" has no description. Add one to help the LLM decide when to show it.` |
| View component bundle is > 500 KB | Warning | `View "X" component is large (N KB). Keep view modules lightweight for fast CDN loading.` |

#### 2.6.7 Deployment

**`kitstack build`:**
1. View metadata included in manifest: `views: [{ slug, name, description, hasComponent }]` (loader is bundled in the kit code, not in the manifest)
2. If any views have `component` set, the SDK runs a vite build to produce chunked ES modules:
   - Per-view modules: `.kitstack/build/views/{slug}.js`
   - Vendor and shared chunks are provided by the platform (already on CDN)
3. Views without `component` use the universal shell's markdown fallback — no build needed

**`deploy-kit` script:**
1. View metadata stored in kit registry (Turso): `kit_views` table with `{ kitId, slug, name, description }`
2. View component modules uploaded to S3/CDN: `s3://kitstack-kit-bundles/{kitId}/{version}/views/{slug}.js`
3. Router reads view data from registry — no hardcoded `VIEW_DATA` map
4. CDN URL for the kit's views is derived from the S3 path and included in the `kit_view` tool result JSON

**Local dev (`kitstack dev`):**
1. Dev server registers both `kit` (text) and `kit_view` (rendering) tools
2. For views with `component`: serves the module from a local dev server (vite dev or static serve of the built module)
3. The loader runs in the dev server process, passes typed data to the view component
4. Sets up `__KITSTACK_MCP__` bridge so views can call `mcp.callTool()` which routes through stdio/relay → dev server → tool handler

#### 2.6.8 Custom view components

Every view has a loader + component. The component uses hooks from `@kitstack/sdk/view` (see section 2.8) to access loader data, call tools, and handle files. Components are React modules that export `mount(container)` and register on `__KITSTACK_VIEWS__`:

```typescript
// views/EmailPreview.tsx
import { createRoot } from "react-dom/client";
import { useKit, useTool, useFile } from "@kitstack/sdk/view";
import type { LoaderData } from "@kitstack/sdk";
import type { loader } from "./loader";

type Data = LoaderData<typeof loader>;

function EmailPreview() {
  const { data, reload } = useKit<Data>();
  const editEmail = useTool("edit_email", { invalidate: reload });
  const file = useFile();

  return (
    <div>
      {data.map(seq => (
        <div key={seq.id}>
          <h3>{seq.name}</h3>
          {seq.emails.map(e => (
            <div key={e.id}>
              <h4>{e.subject}</h4>
              <p>{e.body}</p>
              <button onClick={() => file.copy(`${e.subject}\n\n${e.body}`)}>
                Copy
              </button>
            </div>
          ))}
        </div>
      ))}
      {file.feedback && <Toast message={file.feedback} />}
    </div>
  );
}

// Required: mount function + global registration
export function mount(container: HTMLElement) {
  createRoot(container).render(<EmailPreview />);
}
((window as any).__KITSTACK_VIEWS__ ??= {})["outreach/email-preview"] = { mount };
```

**Build:** `kitstack build` compiles view components into ES modules with the same chunking strategy as first-party views (vendor.js + shared.js + per-view.js). `@kitstack/sdk/view` is included in the shared chunk so hooks are loaded once, not per-view.

### 2.7 Fullstack type safety

The SDK provides end-to-end type flow from Drizzle schema through to view component props. This is the core DX differentiator — like SvelteKit's `load()` → `data` pattern.

#### 2.7.1 The type chain

```
schema.ts (Drizzle)
    │ (table types: sequences.$inferSelect)
    ▼
queries/sequences.ts (optional shared layer)
    │ (function return types)
    ├───────────────────────────────┐
    ▼                               ▼
tools/list-sequences.ts          views/sequence-builder/loader.ts
    │ handler returns               │ loader returns typed data
    │ kit.text(markdown)            │ (return type inferred)
    ▼                               ▼
LLM (reads text)                 views/sequence-builder/View.tsx
                                    │ LoaderData<typeof view> = loader return type
                                    ▼
                                 Typed React component (full autocomplete)
```

Change a column in `schema.ts` → the Drizzle query in `loader.ts` reflects it → the view component's props type changes → TypeScript catches any breakage. No manual interface maintenance.

#### 2.7.2 Concrete example

```typescript
// src/schema.ts — single source of truth
export const sequences = sqliteTable("sequences", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  targetPersona: text("target_persona"),
  createdAt: integer("created_at"),
});
```

```typescript
// src/queries/sequences.ts — shared business logic (optional)
import { sequences, emails } from "../schema";
import { count, eq } from "drizzle-orm";

export async function getSequencesWithCounts(db: LibSQLDatabase) {
  const seqs = await db.select().from(sequences);
  const emailCounts = await db
    .select({ sequenceId: emails.sequenceId, count: count() })
    .from(emails)
    .groupBy(emails.sequenceId);

  return seqs.map(s => ({
    ...s,
    emailCount: emailCounts.find(e => e.sequenceId === s.id)?.count ?? 0,
  }));
}
```

```typescript
// src/tools/list-sequences.ts — for the LLM (text output)
import { defineTool, kit } from "@kitstack/sdk";
import { getSequencesWithCounts } from "../queries/sequences";

export const listSequences = defineTool({
  name: "list_sequences",
  description: "List all sequences with email counts",
  args: z.object({}),
  handler: async (db, args, ctx) => {
    const rows = await getSequencesWithCounts(db);
    const table = rows.map(r => `| ${r.name} | ${r.status} | ${r.emailCount} emails |`).join("\n");
    return kit.text(`| Name | Status | Emails |\n|---|---|---|\n${table}`);
  },
});
```

```typescript
// src/views/sequence-builder/loader.ts — for the view (typed data)
import { defineLoader } from "@kitstack/sdk";
import { getSequencesWithCounts } from "../../queries/sequences";

export const loader = defineLoader(async (db, ctx) => {
  return getSequencesWithCounts(db);
  // Return type inferred: Array<{ id: string; name: string; status: string; emailCount: number; ... }>
});
```

```typescript
// src/views/sequence-builder/View.tsx — receives typed props
import type { LoaderData } from "@kitstack/sdk";
import type { loader } from "./loader";

type Data = LoaderData<typeof loader>;

export function SequenceBuilder({ data }: { data: Data }) {
  // data: Array<{ id: string; name: string; status: string; emailCount: number; ... }>
  // Full autocomplete. Change schema → type error here.
  return (
    <table>
      {data.map(seq => (
        <tr key={seq.id}>
          <td>{seq.name}</td>
          <td>{seq.status}</td>
          <td>{seq.emailCount} emails</td>
        </tr>
      ))}
    </table>
  );
}
```

```typescript
// src/views/sequence-builder/index.ts — wires loader + component
import { defineView } from "@kitstack/sdk";
import { loader } from "./loader";

export default defineView({
  slug: "sequence-builder",
  name: "Sequence Builder",
  description: "after creating or editing sequences and emails",
  loader,
  component: "./View.tsx",
});
```

#### 2.7.3 Loader execution at runtime

The loader runs **server-side before the view mounts** — like SvelteKit's `load()`:

1. LLM calls `kit_view(id="cold-outreach", view="sequence-builder")`
2. Server looks up the view in registry → finds the loader
3. Server executes `loader(db, ctx)` → returns typed data
4. Server serializes the data as JSON into the tool result text block
5. Shell receives the response, parses JSON, passes `data` to the React component as props
6. Component renders immediately — no loading state, no fetch, no `useEffect`

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"view\":\"sequence-builder\",\"data\":[{\"id\":\"abc\",\"name\":\"Q2 Founders\",...}]}"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "ui://kitstack/cold-outreach/sequence-builder",
        "mimeType": "text/html;profile=mcp-app",
        "text": "<!DOCTYPE html>..."
      }
    }
  ]
}
```

The LLM sees the JSON in the text block (context about what the user is viewing). The view component receives the parsed data as typed props.

#### 2.7.4 Why tools and loaders are separate

Tools and loaders serve different consumers and have different contracts:

| | Tool | Loader |
|---|---|---|
| **Consumer** | LLM | View component |
| **Returns** | `KitToolResult` (text/markdown) | Typed data (any serializable value) |
| **Called by** | LLM via `kit(id, cmd, params)` | Server when `kit_view(id, view)` is called |
| **Visible to LLM** | Yes (in `tools/list`) | No (internal to the view) |
| **Can mutate** | Yes (create, update, delete) | No (read-only by convention) |
| **Output optimized for** | Human/LLM reading | Machine processing |

A view's loader and a tool may call the same shared query function (like `getSequencesWithCounts`), but they format the output differently. The tool adds `"Next: add_emails with ID..."` guidance for the LLM. The loader returns raw objects for the component.

#### 2.7.5 Interactive data fetching in views

For views that need to fetch additional data after initial load (drill-down, pagination, filtering):

The view can call `mcp.callTool()` via the `__KITSTACK_MCP__` bridge, but these calls go through the MCP channel and return text. For typed sub-queries, the SDK provides `defineAction` — lightweight server functions callable from views:

```typescript
// src/views/sequence-builder/loader.ts
import { defineLoader, defineAction } from "@kitstack/sdk";
import { emails } from "../../schema";

export const loader = defineLoader(async (db, ctx) => { ... });

// Actions are like loaders but callable on demand from the view
export const getEmailsForSequence = defineAction(
  z.object({ sequenceId: z.string() }),
  async (db, args, ctx) => {
    return db.select().from(emails).where(eq(emails.sequenceId, args.sequenceId));
  }
);
```

```typescript
// In the view component
const mcp = (window as any).__KITSTACK_MCP__;
const emails = await mcp.callAction("getEmailsForSequence", { sequenceId: "abc" });
// emails: Array<{ id, subject, body, ... }> — typed via ActionData<typeof getEmailsForSequence>
```

Actions are registered as internal tools (not visible in `tools/list`) so they're callable via the MCP channel but hidden from the LLM. This keeps the LLM's tool list clean while giving views typed data access.

For v1, eager loading in the loader + `mcp.callTool()` as an escape hatch is sufficient. `defineAction` can come later when views need richer interactivity.

### 2.8 View runtime API (`@kitstack/sdk/view`)

Views are React components that need to interact with the platform: call tools, reload data, download files, import files. Without SDK support, every view reimplements the same `useState` boilerplate for loading/error states, capability detection, and invalidation. The SDK provides three hooks that cover the entire view interaction surface.

#### 2.8.1 `useKit()` — access loader data + reload

The primary hook. Provides pre-loaded data from the loader and a `reload()` function that re-runs the loader via the MCP channel (like SvelteKit's `invalidate()`).

```typescript
import { useKit } from "@kitstack/sdk/view";
import type { LoaderData } from "@kitstack/sdk";
import type { loader } from "./loader";

type Data = LoaderData<typeof loader>;

function SequenceBuilder() {
  const { data, reload, callTool, capabilities } = useKit<Data>();
  // data: typed from loader return type
  // reload(): re-runs loader server-side, updates data
  // callTool(name, params): raw MCP tool call (escape hatch)
  // capabilities: { downloadFile, openLinks, clipboardWrite }
}
```

**`reload()` implementation:** Sends a `tools/call` via the MCP channel with a special invocation that re-runs the view's loader server-side. The server executes `loader(db, ctx)`, serializes the result, and returns it. The hook updates `data` and triggers a React re-render. This is the invalidation mechanism — call it after mutations to refresh the view.

```typescript
interface Kit<TData> {
  data: TData;
  reload: () => Promise<void>;
  callTool: (name: string, params?: Record<string, unknown>) => Promise<string>;
  capabilities: {
    downloadFile: boolean;
    openLinks: boolean;
    clipboardWrite: boolean;
  };
}
```

#### 2.8.2 `useTool()` — tool calls with state + invalidation

Wraps a tool call in a state machine: `idle → loading → success/error`. Handles invalidation on success automatically.

```typescript
import { useKit, useTool } from "@kitstack/sdk/view";

function ProspectList() {
  const { data, reload } = useKit<Data>();
  const addProspect = useTool("add_prospect", { invalidate: reload });
  const setHooks = useTool("set_prospect_hooks", { invalidate: reload });

  return (
    <div>
      {addProspect.error && <div className="error">{addProspect.error}</div>}

      <button
        onClick={() => addProspect.call({ name: "Jane", email: "jane@co.com", sequenceId: "abc" })}
        disabled={addProspect.loading}
      >
        {addProspect.loading ? "Adding..." : "Add Prospect"}
      </button>

      <table>
        {data.map(p => (
          <tr key={p.id}>
            <td>{p.name}</td>
            <td>{p.email}</td>
            <td>
              <button onClick={() => setHooks.call({ prospectId: p.id, hooks: "..." })}>
                Set Hooks
              </button>
            </td>
          </tr>
        ))}
      </table>
    </div>
  );
}
```

```typescript
interface ToolAction {
  call: (params: Record<string, unknown>) => Promise<void>;
  loading: boolean;
  error: string | null;
  reset: () => void;  // Clear error state
}

function useTool(name: string, opts?: { invalidate?: () => Promise<void> }): ToolAction;
```

**Implementation (~20 lines):**
1. `call(params)` → sets `loading: true`, clears `error`
2. Calls `callTool(name, params)` via the MCP bridge
3. On success → calls `invalidate()` if configured → sets `loading: false`
4. On error → sets `error` to the message → sets `loading: false`

Every mutation in every view follows this pattern. `useTool` eliminates 15 lines of boilerplate per action.

#### 2.8.3 `useFile()` — file operations with capability detection

Wraps download, import, and clipboard with automatic fallbacks.

```typescript
import { useKit, useTool, useFile } from "@kitstack/sdk/view";

function ProspectList() {
  const { data, reload } = useKit<Data>();
  const addProspect = useTool("add_prospect", { invalidate: reload });
  const file = useFile();

  const handleExport = () => {
    const csv = "name,email,company\n" + data.map(p => `${p.name},${p.email},${p.company}`).join("\n");
    file.download("prospects.csv", "text/csv", csv);
    // If host supports download → triggers browser download
    // If not → copies to clipboard as fallback
    // Sets file.feedback: "Downloaded prospects.csv" or "Copied to clipboard"
  };

  const handleImport = () => {
    file.open({
      accept: ".csv",
      onFile: async (text) => {
        const rows = parseCSV(text);
        for (const row of rows) {
          await addProspect.call(row);
        }
        // Invalidation happens via addProspect's invalidate config
      },
    });
  };

  return (
    <div>
      <button onClick={handleExport}>Export CSV</button>
      <button onClick={handleImport} disabled={file.importing}>
        {file.importing ? "Importing..." : "Import CSV"}
      </button>
      {file.feedback && <Toast message={file.feedback} />}
    </div>
  );
}
```

```typescript
interface FileActions {
  download: (filename: string, mimeType: string, content: string) => Promise<void>;
  open: (opts: { accept: string; onFile: (text: string) => Promise<void> }) => void;
  copy: (text: string) => Promise<void>;
  canDownload: boolean;
  importing: boolean;
  feedback: string | null;  // Auto-clears after 3 seconds
}
```

**Implementation:**
- `download()` → tries `ui/download-file` via postMessage, falls back to `navigator.clipboard.writeText()`, sets `feedback`
- `open()` → creates hidden `<input type="file">`, reads via `FileReader.readAsText()`, calls `onFile(text)`
- `copy()` → `navigator.clipboard.writeText()`, sets `feedback`
- `feedback` auto-clears via `setTimeout(3000)`

#### 2.8.4 The complete view API

Three hooks, composable:

```typescript
import { useKit, useTool, useFile } from "@kitstack/sdk/view";

// useKit<T>()  — loader data + reload + raw callTool + capabilities
// useTool(name, opts?)  — tool call with loading/error state + invalidation
// useFile()  — download, import, clipboard with fallbacks
```

`useTool` takes `reload` from `useKit` as its invalidation function. `useFile` uses the MCP bridge from `useKit` internally. They compose naturally.

#### 2.8.5 What these hooks are NOT

- **Not reactive primitives** — no signals, no `$derived`, no observable stores. React already has reactivity via `useState` and re-rendering.
- **Not data fetching hooks** — no `useQuery`. The loader handles data fetching server-side. Views don't fetch their own data.
- **Not form state management** — a `useState` for a text input is fine. No `useForm` needed.
- **Not a state management library** — no global store, no context providers. Views are stateless renders of loader data + local interaction state.

The hooks handle exactly the three workflows that every interactive view needs: mutate via tool, reload data, and handle files. Nothing more.

#### 2.8.6 Package details

`@kitstack/sdk/view` is a lightweight browser-side export (~2KB) that gets bundled into the view's `shared.js` chunk by the vite build. It's not a Node.js module — it runs in the iframe sandbox.

```jsonc
// Addition to package.json exports
"./view": {
  "types": "./dist/view/index.d.mts",
  "import": "./dist/view/index.mjs"
}
```

The vite build config (provided by the SDK) includes `@kitstack/sdk/view` as part of the shared chunk so it's loaded once, not per-view.

---

## 3. Persistence

### 3.1 Contract

Kits interact with data exclusively through the `db` parameter (Drizzle ORM over libSQL/Turso). The SDK enforces this — kits cannot import `@libsql/client` directly or access environment variables for database credentials.

**Kit developers define:**
- `schema` — Drizzle table definitions (for type inference and tooling)
- `migrationSql` — Raw SQL `CREATE TABLE` statements

**The runtime provides:**
- A pre-connected `LibSQLDatabase` client scoped to the current user's kit database

### 3.2 Environments

| Environment | Database | How it works |
|------------|----------|--------------|
| Local dev (`kitstack dev`) | SQLite file at `.kitstack/dev.db` | SDK provisions from `migrationSql` on startup |
| Tests (`createTestKit()`) | In-memory SQLite | Fresh database per test, auto-migrated |
| First-party production | Turso (per-user per-kit) | Router provisions via Turso API, kit Lambda receives `dbUrl`/`dbToken` directly |
| Third-party production (sandboxed) | Turso (per-user per-kit) | Router provisions DB, caches credentials server-side. Kit Lambda uses proxied DB adapter — queries routed through McpRouter via `lambda.invoke()`. Kit never sees credentials. |
| Self-hosted (relay) | Developer's choice | Developer provisions their own database, SDK connects via config |

### 3.3 Migration strategy

V1: Raw SQL strings (current approach). Simple, works, no migration tooling needed.

Future: Numbered migration files in `src/migrations/` for incremental schema changes. The SDK would track applied migrations in a `_kitstack_migrations` table. This is out of scope for the initial release — kits are new, there's no migration debt yet.

---

## 4. Package Structure

### 4.1 Monorepo location

The SDK lives at `packages/sdk/` in the existing KitStack monorepo. This enables:
- Simultaneous changes to SDK and production framework
- End-to-end testing (kit definition → deployment → runtime)
- Shared CI pipeline

When the SDK stabilizes (post v1.0), it can be extracted to a separate repo with its own release cadence.

### 4.2 Directory layout

```
packages/sdk/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                  # Public API barrel: defineKit, defineTool, kit, types
│   ├── define-kit.ts             # defineKit() with validation
│   ├── define-tool.ts            # defineTool() with type inference
│   ├── types.ts                  # KitDefinition, ToolDefinition, KitToolResult, KitContext
│   ├── result.ts                 # kit.text(), kit.error(), kit.json(), etc.
│   ├── errors.ts                 # KitStackError hierarchy
│   ├── zod-to-json-schema.ts     # Zod 4 → JSON Schema converter
│   ├── validate.ts               # Kit/tool validation rules
│   ├── authz/
│   │   ├── index.ts              # Re-exports from packages/authz
│   │   └── types.ts              # AuthzRequirement, Relation, ObjectType
│   ├── runtime/
│   │   ├── index.ts              # createKitHandler() — Lambda handler factory
│   │   ├── kit-db.ts             # createKitDbClient() wrapper
│   │   └── dev-server.ts         # Local MCP request handler (tools + kit_view)
│   ├── view/
│   │   ├── index.ts              # useKit, useTool, useFile — browser-side hooks for view components
│   │   └── types.ts              # Kit, ToolAction, FileActions interfaces
│   ├── server/
│   │   ├── index.ts              # serve() — batteries-included MCP server
│   │   ├── mcp-handler.ts        # MCP JSON-RPC protocol, two-tool split, loader execution
│   │   └── auth/
│   │       ├── adapter.ts        # AuthAdapter interface
│   │       ├── none.ts           # No-auth adapter (dev/internal)
│   │       ├── kitstack.ts       # KitStack identity provider adapter
│   │       └── oauth.ts          # Custom OAuth adapter
│   ├── testing/
│   │   ├── index.ts              # createTestKit(), TestKit type
│   │   └── test-db.ts            # In-memory SQLite provisioning
│   ├── cli/
│   │   ├── index.ts              # CLI entry (bin: kitstack)
│   │   ├── dev.ts                # kitstack dev (stdio + relay)
│   │   ├── init.ts               # kitstack init (scaffold)
│   │   ├── login.ts              # kitstack login (browser auth)
│   │   ├── build.ts              # kitstack build (validate + bundle)
│   │   ├── publish.ts            # kitstack publish (submit to marketplace)
│   │   └── relay-client.ts       # WebSocket relay connection
│   └── templates/
│       └── default/              # kitstack init template files
│           ├── kit.config.ts.hbs
│           ├── package.json.hbs
│           ├── tsconfig.json
│           ├── src/
│           │   ├── schema.ts.hbs
│           │   ├── migrations.ts.hbs
│           │   ├── instructions.ts.hbs
│           │   └── tools/
│           │       └── example.ts.hbs
│           └── .gitignore
├── test/
│   ├── define-kit.test.ts
│   ├── define-tool.test.ts
│   ├── validate.test.ts
│   ├── result.test.ts
│   ├── runtime.test.ts
│   └── testing.test.ts          # Tests for the testing utilities themselves
├── docs/                         # Dev notes written per phase (raw material for final docs)
│   ├── notes-phase-1.md
│   ├── notes-phase-2.md
│   └── ...
└── README.md
```

### 4.3 Subpath exports

```jsonc
// packages/sdk/package.json
{
  "name": "@kitstack/sdk",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./testing": {
      "types": "./dist/testing/index.d.mts",
      "import": "./dist/testing/index.mjs"
    },
    "./runtime": {
      "types": "./dist/runtime/index.d.mts",
      "import": "./dist/runtime/index.mjs"
    },
    "./server": {
      "types": "./dist/server/index.d.mts",
      "import": "./dist/server/index.mjs"
    },
    "./authz": {
      "types": "./dist/authz/index.d.mts",
      "import": "./dist/authz/index.mjs"
    },
    "./errors": {
      "types": "./dist/errors.d.mts",
      "import": "./dist/errors.mjs"
    },
    "./view": {
      "types": "./dist/view/index.d.mts",
      "import": "./dist/view/index.mjs"
    },
    "./internal/*": null
  },
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "bin": {
    "kitstack": "./dist/cli/index.mjs"
  },
  "files": ["dist"],
  "peerDependencies": {
    "zod": "^3.22.0",
    "drizzle-orm": "^0.38.0"
  },
  "dependencies": {
    "@libsql/client": "^0.14.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^2.0.0",
    "publint": "^0.2.0",
    "@arethetypeswrong/cli": "^0.15.0"
  }
}
```

**Import patterns for kit developers:**

```typescript
// Kit authoring (95% of usage)
import { defineKit, defineTool, defineView, defineLoader, kit } from "@kitstack/sdk";
import type { LoaderData } from "@kitstack/sdk";

// Tests
import { createTestKit } from "@kitstack/sdk/testing";

// View components (browser-side, bundled into shared.js)
import { useKit, useTool, useFile } from "@kitstack/sdk/view";

// Self-hosted server
import { serve, kitstack, oauth } from "@kitstack/sdk/server";

// Advanced: low-level runtime (Lambda handler)
import { createKitHandler } from "@kitstack/sdk/runtime";

// Advanced: authz declarations
import type { AuthzRequirement } from "@kitstack/sdk/authz";
```

**What each export contains:**

| Export | Contains | Used by |
|--------|----------|---------|
| `@kitstack/sdk` | `defineKit`, `defineTool`, `defineView`, `defineLoader`, `kit` result helpers, `LoaderData` type, all types | Kit developers (every kit) |
| `@kitstack/sdk/testing` | `createTestKit`, `TestKit` type | Kit developers (test files) |
| `@kitstack/sdk/runtime` | `createKitHandler`, `createKitDbClient`, `createProxiedDbClient` | Production framework (Lambda handler) |
| `@kitstack/sdk/server` | `serve`, `kitstack`, `oauth` auth adapters | Self-hosted deployments (standalone, container, monolith) |
| `@kitstack/sdk/authz` | `AuthzRequirement`, `Relation`, `ObjectType` types | Kit developers (authz declarations) |
| `@kitstack/sdk/errors` | `KitStackError`, `KitValidationError`, etc. | Kit developers (error handling in tests) |
| `@kitstack/sdk/view` | `useKit`, `useTool`, `useFile` hooks | Kit developers (inside view components, bundled into shared.js) |

### 4.4 Build tooling

**tsup** for building (mature, esbuild-based, generates ESM + dts in one command):

```typescript
// packages/sdk/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",    // defineKit, defineTool, defineView, defineLoader, kit helpers
    "testing/index": "src/testing/index.ts",
    "runtime/index": "src/runtime/index.ts",
    "server/index": "src/server/index.ts",
    "view/index": "src/view/index.ts",
    "authz/index": "src/authz/index.ts",
    errors: "src/errors.ts",
    "cli/index": "src/cli/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  target: "node20",
  external: ["zod", "drizzle-orm"],
});
```

**CI validation:**
- `publint` — validates package.json exports, module format
- `attw` (Are The Types Wrong) — validates TypeScript resolution
- Both run on every PR

---

## 5. Testing Framework

### 5.1 `createTestKit()`

The primary testing utility. Creates an isolated in-memory SQLite database, runs migrations, and provides direct tool invocation.

```typescript
import { createTestKit } from "@kitstack/sdk/testing";
import { describe, it, expect, afterEach } from "vitest";
import { outreachKit } from "../src";
import { sequences } from "../src/schema";

describe("outreach kit", () => {
  const testKit = await createTestKit(outreachKit);

  afterEach(async () => {
    await testKit.reset(); // Wipes and re-migrates
  });

  it("creates a sequence", async () => {
    const result = await testKit.call("create_sequence", {
      name: "Series A founders",
      targetPersona: "VPs of Engineering",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Series A founders");

    // Direct DB access for assertions
    const rows = await testKit.db.select().from(sequences);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Series A founders");
  });

  it("rejects invalid arguments", async () => {
    const result = await testKit.call("create_sequence", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name");
  });
});
```

### 5.2 `TestKit` API

```typescript
interface TestKit {
  /** Drizzle client connected to the test database. Use for assertions. */
  db: LibSQLDatabase;

  /** Call a tool by name with arguments. Returns KitToolResult. */
  call(toolName: string, args: Record<string, unknown>): Promise<KitToolResult>;

  /** Call a tool with a custom context (e.g. different userId). */
  callAs(ctx: Partial<KitContext>, toolName: string, args: Record<string, unknown>): Promise<KitToolResult>;

  /** Wipe the database and re-run migrations. */
  reset(): Promise<void>;

  /** Close the database connection. Call in afterAll(). */
  cleanup(): Promise<void>;
}
```

### 5.3 Implementation

```typescript
export async function createTestKit(kit: KitDefinition): Promise<TestKit> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);

  // Run migrations
  const statements = kit.migrationSql.split(";").filter((s) => s.trim());
  for (const stmt of statements) {
    await client.execute(stmt);
  }

  const toolMap = new Map(kit.tools.map((t) => [t.name, t]));
  const defaultCtx: KitContext = { userId: "test-user", kitId: kit.id };

  return {
    db,
    async call(toolName, args) {
      return this.callAs({}, toolName, args);
    },
    async callAs(ctxOverrides, toolName, args) {
      const ctx = { ...defaultCtx, ...ctxOverrides };
      const tool = toolMap.get(toolName);
      if (!tool) return kit.error(`Unknown tool: ${toolName}`);

      const parsed = tool.args.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}` }],
          isError: true,
        };
      }

      // Run authorize hook if present
      if (tool.authorize) {
        const requirements = tool.authorize(parsed.data, ctx);
        // In tests, authz checks run against the test DB (kit developer seeds tuples)
      }

      return tool.handler(db, parsed.data, ctx);
    },
    async reset() {
      // Drop all tables, re-run migrations
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      for (const row of tables.rows) {
        await client.execute(`DELETE FROM ${row.name}`);
      }
    },
    async cleanup() {
      client.close();
    },
  };
}
```

---

## 6. Authentication with KitStack

### 6.1 Developer auth flow (`kitstack login`)

```
Developer                                KitStack
    │                                       │
    $ kitstack login                        │
    │                                       │
    │ 1. Start localhost callback server     │
    │ 2. Open browser ──────────────────────→│
    │    https://kitstack.co/cli/authorize   │
    │         ?callback=http://localhost:9876 │
    │                                       │
    │                          User logs in  │
    │                          (BetterAuth)  │
    │                          Clicks        │
    │                          "Authorize"   │
    │                                       │
    │ 3. Redirect ←─────────────────────────│
    │    http://localhost:9876               │
    │         ?token=kst_abc123...          │
    │                                       │
    │ 4. Save to ~/.kitstack/credentials    │
    │ 5. Print "Authenticated as enes@..."  │
    ▼                                       ▼
```

### 6.2 Token format

- **Opaque token** (not JWT) — `kst_` prefix + 48-char random string
- Stored server-side in the `OAuthStore` DynamoDB table: `{ pk: "CLI_TOKEN#kst_abc...", sk: "META", userId, createdAt, lastUsedAt, ttl }`
- Revocable from the KitStack dashboard (list active CLI sessions, revoke any)
- No expiration by default — revoke to deactivate

**Why opaque, not JWT:** Long-lived tokens must be revocable. JWTs are self-verifiable and can't be revoked without a blocklist. An opaque token requires a server-side lookup, which gives instant revocation.

### 6.3 Token scopes (future)

V1: All tokens have full developer access (dev relay, publish).

Future scopes:
- `dev:relay` — connect dev server to relay
- `publish` — submit kits for review
- `manage` — manage published kits (unpublish, update metadata)

### 6.4 Token storage

```json
// ~/.kitstack/credentials.json (file permissions: 0600)
{
  "token": "kst_abc123...",
  "email": "enes@kitstack.co",
  "authenticatedAt": "2026-04-24T10:00:00Z"
}
```

### 6.5 Infrastructure additions

| Component | What |
|-----------|------|
| `src/app/cli/authorize/page.tsx` | "Authorize KitStack CLI" page with approve/deny |
| `src/app/api/cli/token/route.ts` | Generates opaque token, stores in OAuthStore |

---

## 7. CLI Tooling

### 7.1 Commands

```
kitstack <command>

Commands:
  kitstack init <name>     Scaffold a new kit project
  kitstack dev             Start local dev server
  kitstack build           Validate and bundle kit for deployment
  kitstack login           Authenticate with KitStack
  kitstack publish         Submit kit to KitStack marketplace

Options:
  --help                   Show help
  --version                Show version
```

### 7.2 `kitstack init <name>`

Scaffolds a new kit project using templates from `src/templates/default/`.

```bash
$ npx @kitstack/sdk init my-crm-kit

  Creating my-crm-kit...

  ✓ Created kit.config.ts
  ✓ Created package.json
  ✓ Created tsconfig.json
  ✓ Created src/schema.ts
  ✓ Created src/migrations.ts
  ✓ Created src/instructions.ts
  ✓ Created src/tools/example.ts
  ✓ Created .gitignore

  Next steps:
    cd my-crm-kit
    npm install
    npx kitstack dev --stdio
```

**Scaffolded project structure:**

```
my-crm-kit/
├── kit.config.ts             # defineKit() — wires tools, views, schema, migrations, instructions
├── package.json              # @kitstack/sdk + zod + drizzle-orm as deps
├── tsconfig.json
├── src/
│   ├── schema.ts             # Drizzle table definitions (single source of truth)
│   ├── migrations.ts         # Raw SQL CREATE TABLE statements
│   ├── instructions.ts       # LLM behavioral prompt
│   ├── tools/
│   │   └── example.ts        # defineTool() with handler
│   └── views/
│       └── dashboard/
│           ├── index.ts      # defineView({ loader, component })
│           ├── loader.ts     # defineLoader() — server-side typed data
│           └── View.tsx      # React component — receives typed props
├── test/
│   └── tools.test.ts         # Example test using createTestKit()
└── .gitignore                # .kitstack/, node_modules/, dist/
```

`kit.config.ts` is the table of contents — it imports everything and wires it together, like `sst.config.ts` or `drizzle.config.ts`:

```typescript
// kit.config.ts
import { defineKit } from "@kitstack/sdk";
import { schema } from "./src/schema";
import { migrationSql } from "./src/migrations";
import { instructions } from "./src/instructions";
import { exampleTool } from "./src/tools/example";
import dashboard from "./src/views/dashboard";

export default defineKit({
  id: "my-crm-kit",
  name: "My CRM Kit",
  description: "A simple CRM for managing contacts and deals",
  schema,
  migrationSql,
  instructions,
  tools: [exampleTool],
  views: [dashboard],
});
```

### 7.3 `kitstack dev`

```
kitstack dev [options]
  --stdio          Use stdio transport (for Claude Desktop/Code)
  --config <path>  Path to kit config file (default: ./kit.config.ts)
  --db <path>      SQLite database path (default: .kitstack/dev.db)
  --reset-db       Delete and re-provision the database
```

**Default (relay mode):**

1. Reads kit definition from `./kit.config.ts`
2. Provisions local SQLite at `.kitstack/dev.db`, runs `migrationSql`
3. Reads auth token from `~/.kitstack/credentials.json`
4. Connects to `wss://relay.kitstack.co?sessionId={id}&token={token}`
5. Prints the public URL: `https://mcp.kitstack.co/dev/{sessionId}`
6. Receives MCP requests via WebSocket, processes them locally, sends responses back

**Stdio mode (`--stdio`):**

1. Same kit loading and DB provisioning
2. Reads MCP JSON-RPC from stdin, writes to stdout
3. Zero-latency, no network dependency
4. Configure in Claude Desktop/Code MCP settings:
   ```json
   { "command": "npx", "args": ["kitstack", "dev", "--stdio"] }
   ```

### 7.4 `kitstack build`

Validates the kit and produces a deployment bundle.

1. Load kit definition from `kit.config.ts`
2. Run all validations (tool descriptions, arg descriptions, snake_case names, migration SQL, view references)
3. Bundle with esbuild into a single `.mjs` file (tree-shaken, externals: `@kitstack/sdk/runtime`, `zod`, `drizzle-orm`, `@libsql/client`)
4. Build view components (if any) into ES modules: `.kitstack/build/views/{slug}.js`
5. Output to `.kitstack/build/kit.mjs`
6. Generate manifest: `.kitstack/build/manifest.json`

```json
// .kitstack/build/manifest.json
{
  "kitId": "cold-outreach",
  "kitName": "Cold Outreach",
  "version": "1.0.0",
  "tools": [
    { "name": "create_sequence", "description": "Create a new email sequence..." },
    { "name": "list_sequences", "description": "List all sequences..." },
    { "name": "generate_emails", "description": "Generate email copies..." }
  ],
  "views": [
    { "slug": "sequence-builder", "name": "Sequence Builder", "description": "after creating or editing sequences" },
    { "slug": "prospect-list", "name": "Prospect List", "description": "after adding prospects" },
    { "slug": "email-preview", "name": "Email Preview", "description": "to review email content" }
  ],
  "migrationSql": "CREATE TABLE IF NOT EXISTS sequences (...);",
  "bundleHash": "sha256:abc123...",
  "bundleSizeBytes": 12480,
  "sdkVersion": "0.1.0"
}
```

### 7.5 `kitstack publish`

Submits a built kit to the KitStack marketplace.

1. Run `kitstack build` if no build output exists
2. Read auth token from `~/.kitstack/credentials.json`
3. Upload bundle + manifest to KitStack API: `POST https://api.kitstack.co/kits/publish`
4. Server-side: automated scanning (static analysis for dangerous imports, dependency audit)
5. Response: `{ status: "pending_review", kitId, version }`
6. Kit enters review queue → approved → deployed as sandboxed Lambda

---

## 8. Local Development Runtime

### 8.1 `dev-server.ts` — MCP request handler

The core MCP protocol handler shared by `kitstack dev` and `serve()`. Both the dev CLI and the self-hosted `serve()` (section 10.3) use this same handler — `serve()` wraps it with auth, DB management, and HTTP/stdio transport.

```typescript
export function createDevServer(kit: KitDefinition, db: LibSQLDatabase) {
  const toolMap = new Map(kit.tools.map((t) => [t.name, t]));
  const viewMap = new Map((kit.views ?? []).map((v) => [v.slug, v]));
  const ctx: KitContext = { userId: "dev-user", kitId: kit.id };

  // Build flat tool list: all kit tools + kit_view (if kit has views)
  const flatTools = kit.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.args),
  }));

  if (kit.views?.length) {
    flatTools.push({
      name: "kit_view",
      description: `Show interactive UI for ${kit.name}. Views: ${kit.views.map((v) => `${v.slug} — ${v.description}`).join("; ")}`,
      inputSchema: {
        type: "object",
        properties: {
          view: { type: "string", description: "View slug to display" },
        },
      },
      // _meta.ui.resourceUri is attached at the tool definition level
      _meta: { ui: { resourceUri: `ui://kitstack/${kit.id}/app` } },
    });
  }

  async function callTool(toolName: string, args: Record<string, unknown>) {
    const tool = toolMap.get(toolName);
    if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    const parsed = tool.args.safeParse(args);
    if (!parsed.success) return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    return tool.handler(db, parsed.data, ctx);
  }

  return {
    async handleRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
      switch (method) {
        case "initialize":
          return {
            protocolVersion: "2024-11-05",
            serverInfo: { name: kit.name, version: "dev" },
            capabilities: {
              tools: {},
              extensions: { "io.modelcontextprotocol/ui": {} },
            },
          };

        case "tools/list":
          return { tools: flatTools };

        case "tools/call": {
          const toolName = (params as any)?.name;

          // kit_view tool — render a view
          if (toolName === "kit_view") {
            const viewSlug = (params as any)?.arguments?.view;
            const view = viewSlug ? viewMap.get(viewSlug) : null;

            if (!view) {
              // No view specified — list available views
              const listing = kit.views!.map((v) => `- **${v.slug}** — ${v.description}`).join("\n");
              return { content: [{ type: "text", text: listing }] };
            }

            // Execute the view's loader (server-side, typed data)
            const data = await view.loader(db, ctx);
            const dataJson = JSON.stringify({ view: view.slug, data });

            // Always use the app shell — it loads the view module from CDN (or local dev server)
            // If the view has a component, the shell loads it dynamically
            // If not, the shell falls back to markdown rendering
            const html = BUNDLED_APP_SHELL;

            return {
              content: [
                { type: "text", text: dataJson },
                {
                  type: "resource",
                  resource: {
                    uri: `ui://kitstack/${kit.id}/${view.slug}`,
                    mimeType: "text/html;profile=mcp-app",
                    text: html,
                  },
                },
              ],
            };
          }

          // Regular tool — text-only
          return callTool(toolName, (params as any)?.arguments ?? {});
        }

        // ... notifications/initialized, ping
      }
    },
  };
}
```

**Two-tool split in dev mode:** The dev server registers all kit tools flat (no onion routing — there's only one kit) plus a `kit_view` tool if the kit has views. This mirrors production behavior where `kit` handles CRUD and `kit_view` handles rendering.

**Data via MCP channel:** The shell calls `tools/call` via postMessage to fetch data. The dev server handles these calls the same as direct tool calls — no separate AppData server needed.

### 8.2 `relay-client.ts` — WebSocket connection

```typescript
export async function connectRelay(opts: { sessionId: string; token: string; devServer: DevServer }) {
  const ws = new WebSocket(`wss://relay.kitstack.co?sessionId=${opts.sessionId}&token=${opts.token}`);

  ws.on("message", async (data) => {
    const { requestId, method, params } = JSON.parse(data);
    const result = await opts.devServer.handleRequest(method, params);
    ws.send(JSON.stringify({ requestId, result }));
  });

  ws.on("close", () => {
    // Reconnect with exponential backoff (1s, 2s, 4s, max 30s)
  });
}
```

### 8.3 `dev-db.ts` — Local SQLite provisioning

```typescript
export async function provisionDevDb(dbPath: string, migrationSql: string, opts?: { reset?: boolean }): Promise<LibSQLDatabase> {
  if (opts?.reset && existsSync(dbPath)) unlinkSync(dbPath);
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client);

  const statements = migrationSql.split(";").filter((s) => s.trim());
  for (const stmt of statements) {
    await client.execute(stmt);
  }

  return db;
}
```

---

## 9. Relay Infrastructure

### 9.1 WebSocket API Gateway

Add to `infra/mcp.ts`:

```typescript
const devRelay = new sst.aws.ApiGatewayWebSocket("DevRelay", {
  // $connect, $disconnect, $default routes — three small Lambda handlers
});
```

### 9.2 Lambda handlers

**`$connect` (~40 lines):**
1. Extract `sessionId` and `token` from query params
2. Look up token in OAuthStore: `CLI_TOKEN#{token}` → get `userId`
3. Reject if invalid token (401)
4. Check concurrent sessions: query `DEV_SESSION#` prefix for this userId, enforce max 2
5. Store session: `{ pk: "DEV_SESSION#{sessionId}", sk: "CONNECTION", connectionId, userId, ttl: now + 24h }`

**`$disconnect` (~15 lines):**
1. Delete `DEV_SESSION#{sessionId}` from OAuthStore

**`$default` (~25 lines):**
1. Parse WebSocket message as `{ requestId, result }`
2. Store response: `{ pk: "DEV_REQ#{requestId}", sk: "RESPONSE", body: JSON.stringify(result), ttl: now + 60s }`

### 9.3 McpRouter relay route

New route in `packages/mcp-server/src/router/handler.ts`:

```
POST /dev/{sessionId}  →  relay MCP request to connected dev server
```

Flow:
1. Look up `DEV_SESSION#{sessionId}` in OAuthStore → get `connectionId`
2. If not found, return 404 (dev server not connected)
3. Generate `requestId` (nanoid)
4. Send request to dev server: `apiGatewayManagement.postToConnection(connectionId, { requestId, method, params })`
5. Poll OAuthStore every 100ms for `DEV_REQ#{requestId}` with `RESPONSE` (max 30s)
6. Return result to LLM client as MCP JSON-RPC response

---

## 10. Deployment

### 10.1 First-party kits (dogfood)

First-party kits import from `@kitstack/sdk` and are deployed through the same dynamic pipeline as third-party kits (see section 11). They use `kit.config.ts`, the same directory structure, and the same `deploy-kit` script. The only difference: first-party kits can use direct DB invocation (dbUrl/dbToken in the Lambda event) instead of the proxied adapter, since they're trusted code.

```typescript
// packages/mcp-server/src/kits/outreach/tools/create-sequence.ts (after migration)
import { defineTool, kit } from "@kitstack/sdk";

export const createSequence = defineTool({
  name: "create_sequence",
  description: "Create a new email sequence for cold outreach",
  args: z.object({ ... }),
  handler: async (db, args, ctx) => {
    const id = nanoid();
    await db.insert(sequences).values({ ... });
    return kit.text(`Sequence "${args.name}" created (ID: ${id}). Next: generate_emails.`);
  },
});
```

See section 11 (Dogfooding Strategy) for the full migration plan including dynamic Lambda deployment and the `deploy-kit` admin script.

### 10.2 Third-party kits: Managed deployment (sandboxed Lambda)

When a kit passes review after `kitstack publish`, KitStack deploys it as an isolated Lambda function.

#### 10.2.1 Sandbox architecture

The kit Lambda never touches the database directly. Instead, the McpRouter acts as a DB proxy — the kit Lambda invokes the router via `lambda.invoke()` for every database operation. The kit never receives database credentials.

```
LLM client
    │
    POST / (MCP request)
    │
    ▼
McpRouter
    │
    │ 1. Generate invocationToken (nanoid)
    │ 2. Cache DB credentials in OAuthStore keyed by token (60s TTL)
    │ 3. lambda.invoke(ThirdPartyKit, { toolName, args, userId, kitId, invocationToken, routerArn })
    │
    ▼
ThirdPartyKit Lambda (no VPC, no credentials, no env vars)
    │
    │ IAM role: lambda:InvokeFunction on McpRouter ONLY
    │
    │ Kit handler calls db.insert(sequences).values(...)
    │    ↓
    │ SDK proxied DB adapter intercepts the query
    │    ↓
    │ lambda.invoke(McpRouter, { __dbProxy: true, invocationToken, sql, params })
    │
    ▼
McpRouter (DB proxy handler)
    │
    │ 1. Validate invocationToken against cached credentials
    │ 2. Connect to Turso with cached dbUrl/dbToken
    │ 3. Execute SQL query
    │ 4. Return rows
    │
    ▼
Turso (user's kit database)
```

**Why no VPC:** The kit Lambda's only IAM permission is `lambda:InvokeFunction` on the McpRouter. It has no database credentials, no env vars, no other AWS permissions. Network exfiltration via `fetch()` is a theoretical risk, but:
- The kit can already exfiltrate data through its MCP response (return it as tool output)
- Static analysis at build time flags `fetch`/`http`/`net`/`child_process` imports
- Code review catches anything the scanner misses
- The handler contract `(db, args, ctx) → KitToolResult` limits what the kit can meaningfully do

No VPC means no NAT Gateway cost, no VPC endpoint cost, no cold start penalty from ENI attachment, and simpler infrastructure.

#### 10.2.2 Proxied DB adapter

The SDK ships a proxied Drizzle adapter for sandboxed kits. Kit code doesn't change — `db.insert(...)` works identically in local dev, first-party production, and third-party sandboxed mode. The adapter is injected by the runtime, not by the kit author.

```typescript
// @kitstack/sdk/runtime (sandboxed mode — used by generic third-party handler)
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({});

function createProxiedDbClient(routerArn: string, invocationToken: string) {
  // Custom libSQL-compatible client that routes queries through the router
  const client = {
    async execute(stmt: { sql: string; args?: unknown[] }) {
      const response = await lambda.send(new InvokeCommand({
        FunctionName: routerArn,
        Payload: JSON.stringify({
          __dbProxy: true,
          invocationToken,
          sql: stmt.sql,
          args: stmt.args ?? [],
        }),
      }));
      return JSON.parse(new TextDecoder().decode(response.Payload));
    },
    async batch(stmts: Array<{ sql: string; args?: unknown[] }>) {
      const response = await lambda.send(new InvokeCommand({
        FunctionName: routerArn,
        Payload: JSON.stringify({
          __dbProxy: true,
          invocationToken,
          batch: stmts,
        }),
      }));
      return JSON.parse(new TextDecoder().decode(response.Payload));
    },
  };
  return drizzle(client);
}
```

#### 10.2.3 McpRouter DB proxy handler

New branch in the McpRouter's Lambda handler — when the event contains `__dbProxy: true`, it acts as a database proxy instead of processing MCP requests:

```typescript
// packages/mcp-server/src/router/handler.ts (new branch)
if (event.__dbProxy) {
  const { invocationToken, sql, args, batch } = event;

  // 1. Look up cached credentials
  const cached = await getOAuthStoreItem(`INVOCATION#${invocationToken}`, "DB_CREDS");
  if (!cached) return { error: "INVALID_TOKEN" };

  const { dbUrl, dbToken, userId, kitId } = JSON.parse(cached.data);

  // 2. Connect to Turso
  const client = createClient({ url: dbUrl, authToken: dbToken });

  // 3. Execute
  if (batch) {
    const results = await client.batch(batch);
    return { results };
  }
  const result = await client.execute({ sql, args });
  return { columns: result.columns, rows: result.rows, rowsAffected: result.rowsAffected };
}
```

**Invocation token lifecycle:**
1. McpRouter dispatches a tool call → generates `invocationToken` (nanoid), stores `{ pk: "INVOCATION#{token}", sk: "DB_CREDS", data: { dbUrl, dbToken, userId, kitId }, ttl: now + 60s }` in OAuthStore
2. Kit Lambda receives `invocationToken` + `routerArn` (no DB credentials)
3. Kit Lambda's DB calls go through the proxied adapter → invoke McpRouter with the token
4. McpRouter validates token, executes query, returns result
5. Token expires after 60s (single tool call should complete well within this)

#### 10.2.4 Security boundaries

| Threat | Mitigation |
|--------|------------|
| Database credential theft | Kit Lambda never receives `dbUrl`/`dbToken`. Credentials are cached server-side in OAuthStore, keyed by a short-lived invocation token. |
| Cross-user data access | Invocation token is scoped to one user's kit database. The router validates the token and connects to the correct database — the kit cannot influence which database is used. |
| Lateral movement (AWS resources) | IAM role allows only `lambda:InvokeFunction` on McpRouter ARN. No S3, no DynamoDB, no other Lambda, no EC2. |
| Network exfiltration | Build-time static analysis flags `fetch`, `http`, `https`, `net`, `child_process`, `WebSocket` imports. Code review as second layer. The kit can also exfiltrate via MCP response — network isn't the only vector, so defense-in-depth via review is the real control. |
| Crypto mining / resource abuse | 256 MB memory, 30s timeout. CloudWatch alarm on sustained high CPU. Account suspension on abuse. |
| Environment variable sniffing | No env vars set. `process.env` is empty. Router ARN and invocation token are passed as function arguments, not environment. |
| Invocation token replay | 60s TTL. Token is single-use per tool invocation and scoped to one userId + kitId pair. |
| Kit impersonation | Bundle hash verified at deployment. Kit ID and version are immutable once published. |

#### 10.2.5 Build pipeline

```
kitstack publish
    │
    ▼
KitStack API (POST /kits/publish)
    │
    ├── 1. Verify auth token
    ├── 2. Unpack bundle + manifest
    ├── 3. Automated checks:
    │       - Static analysis: scan bundle for require("child_process"), import("net"),
    │         import("http"), fetch(), WebSocket, etc.
    │       - npm audit: check bundled dependencies for known vulnerabilities
    │       - Size limit: bundle must be < 5 MB
    │       - Manifest validation: kit ID format, tool names, descriptions present
    │       - Migration SQL: run against empty SQLite to verify syntax
    ├── 4. Store bundle in S3: s3://kitstack-kit-bundles/{kitId}/{version}/kit.mjs
    ├── 5. Queue for review (initially manual, automated later)
    │
    ▼
Review approved
    │
    ├── 6. Deploy Lambda:
    │       - Runtime layer: Node.js 22 + @kitstack/sdk/runtime + @aws-sdk/client-lambda
    │       - Code: kit bundle from S3
    │       - Handler: generic wrapper that loads bundle + calls createKitHandler
    │       - No VPC (no NAT, no ENI cold start penalty)
    │       - IAM: lambda:InvokeFunction on McpRouter ARN only
    │       - No env vars
    │       - Memory: 256 MB, timeout: 30s, architecture: arm64
    │
    ├── 7. Register in kit registry (Turso):
    │       - kit_registry rows for each tool (name, description, inputSchema, lambdaArn)
    │       - kit metadata (name, description, author, version)
    │
    └── 8. Kit available in marketplace
```

#### 10.2.6 Generic Lambda handler (runtime layer)

Third-party kit Lambdas use a generic handler that loads the kit bundle and wires up the proxied DB adapter:

```typescript
// infra/runtime/third-party-handler.ts
import { createKitHandler } from "@kitstack/sdk/runtime";
import { createProxiedDbClient } from "@kitstack/sdk/runtime/proxied-db";
import type { KitToolResult } from "@kitstack/sdk";

// Kit bundle is loaded at cold start
const kitModule = await import("./kit.mjs");
const kit = kitModule.default;

interface SandboxedInvocation {
  toolName: string;
  args: Record<string, unknown>;
  userId: string;
  kitId: string;
  invocationToken: string;
  routerArn: string;
}

export async function main(event: SandboxedInvocation): Promise<KitToolResult> {
  // Create a proxied DB client that routes queries through the router
  const db = createProxiedDbClient(event.routerArn, event.invocationToken);
  const ctx = { userId: event.userId, kitId: event.kitId };

  const tool = kit.tools.find((t) => t.name === event.toolName);
  if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${event.toolName}` }], isError: true };

  const parsed = tool.args.safeParse(event.args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}` }],
      isError: true,
    };
  }

  return tool.handler(db, parsed.data, ctx);
}
```

This handler is different from first-party kits: it uses `createProxiedDbClient` instead of `createKitDbClient`. The kit code itself is identical — `defineTool` handlers receive a Drizzle `db` and call `.insert()`, `.select()`, etc. The proxy is invisible to the kit author.

### 10.3 Self-hosted runtime (`@kitstack/sdk/server`)

The SDK provides a batteries-included MCP server for self-hosted deployments. It handles MCP protocol, the two-tool split (`kit` + `kit_view`), loader execution, view serving, DB connections, and auth — everything the McpRouter does, packaged as a library.

#### 10.3.1 `serve()` API

```typescript
import { serve, kitstack, oauth } from "@kitstack/sdk/server";

serve({
  kit,                    // Single kit (or kits: [...] for monolith)
  auth,                   // "none" | kitstack({...}) | oauth({...})
  relay?,                 // Connect via KitStack relay (overrides auth)
  db,                     // Database connection config
  port?,                  // HTTP port (default: 3000)
  transport?,             // "http" | "stdio" (default: "http")
});
```

#### 10.3.2 Deployment modes

**Local dev (relay):**

```typescript
// What `kitstack dev` runs internally
serve({
  kit,
  relay: { token: credentials.token },
  db: { url: "file:.kitstack/dev.db" },
  transport: "stdio",  // or relay for remote LLM clients
});
```

**Self-hosted, single kit (KitStack relay for public URL):**

```typescript
// server.ts — on developer's VPS/Fly.io/container
import { serve } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  relay: { token: process.env.KITSTACK_TOKEN },
  db: {
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_TOKEN,
  },
});
// KitStack handles auth + public URL. Developer manages compute + DB.
```

**Self-hosted, direct (KitStack as identity provider):**

```typescript
import { serve, kitstack } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  auth: kitstack({
    clientId: process.env.KITSTACK_CLIENT_ID,
    clientSecret: process.env.KITSTACK_CLIENT_SECRET,
  }),
  db: { url: process.env.DATABASE_URL },
  port: 3000,
});
// Developer has public URL. KitStack handles user identity.
```

**Monolith (multiple kits, one server):**

```typescript
import { serve, kitstack } from "@kitstack/sdk/server";
import crmKit from "./kits/crm/kit.config";
import outreachKit from "./kits/outreach/kit.config";
import expenseKit from "./kits/expense/kit.config";

serve({
  kits: [crmKit, outreachKit, expenseKit],
  auth: kitstack({ clientId: "...", clientSecret: "..." }),
  databases: {
    "crm": { url: process.env.CRM_DB },
    "cold-outreach": { url: process.env.OUTREACH_DB },
    "expense-tax-prep": { url: process.env.EXPENSE_DB },
  },
  port: 3000,
});
// Single process, single port. Server handles onion routing across kits.
```

**Fully self-hosted (no KitStack dependency):**

```typescript
import { serve, oauth } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  auth: oauth({
    issuer: "https://my-kit.example.com",
    authorize: async (req) => {
      return { redirect: "https://auth.example.com/login?..." };
    },
    validateToken: async (token) => {
      const user = await myUserDb.findByToken(token);
      return user ? { userId: user.id } : null;
    },
  }),
  db: { url: process.env.DATABASE_URL },
  port: 3000,
});
// No KitStack dependency at all. Developer handles everything.
```

#### 10.3.3 Auth adapters

Auth adapters share a common interface — they all produce a `userId` from a request:

```typescript
interface AuthAdapter {
  metadata(): OAuthServerMetadata;
  authorize(req: Request): Promise<{ redirect: string }>;
  token(req: Request): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
  revoke(req: Request): Promise<void>;
  validate(token: string): Promise<{ userId: string } | null>;
}
```

**`"none"` — no auth (development, internal tools):**

No OAuth endpoints. All requests are treated as a default user. Good for `kitstack dev`, private networks, or kits behind a VPN.

**`kitstack()` — KitStack as identity provider:**

KitStack becomes "Sign in with KitStack" — like "Sign in with Google" but for kit users. Users sign up on kitstack.co (via BetterAuth). The developer's server delegates all identity to KitStack. See section 10.4 for the full flow.

**`oauth()` — fully custom auth:**

The SDK provides the MCP OAuth protocol plumbing (metadata endpoint, token endpoint format, JSON-RPC auth errors). The developer provides `authorize` (redirect to their login) and `validateToken` (check against their user store).

**Relay mode** bypasses auth entirely — KitStack authenticates the user and forwards pre-authenticated requests with `userId` already set.

#### 10.3.4 What `serve()` handles

`serve()` is the self-hosted equivalent of KitStack's McpRouter. It handles:

| Concern | How |
|---------|-----|
| MCP JSON-RPC protocol | `initialize`, `tools/list`, `tools/call` |
| Two-tool split | Registers `kit` (text) + `kit_view` (rendering) tools |
| Kit discover | `kit()` → list kits, `kit(id)` → show actions + views |
| Tool dispatch | `kit(id, cmd, params)` → route to tool handler |
| View rendering | `kit_view(id, view)` → execute loader → build embedded resource |
| Loader execution | Runs view's `loader(db, ctx)` server-side, serializes data |
| App shell serving | Returns shell HTML with view data in embedded resource |
| OAuth endpoints | `/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/revoke` |
| DB connection management | Per-kit connections, per-user isolation (when using KitStack DB provisioning) |
| HTTP + stdio transports | Configurable via `transport` option |
| Relay connection | WebSocket to `relay.kitstack.co` (when `relay` is set) |

#### 10.3.5 Container deployment

A container is just a deployment target for `serve()`. Same code, packaged in Docker:

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Works on Docker, Fly.io, Railway, ECS, Cloud Run, or any container platform.

### 10.4 KitStack as identity provider

When a developer uses `auth: kitstack()`, KitStack handles user identity. Users sign up on kitstack.co — same BetterAuth instance, same accounts they'd use for KitStack marketplace kits.

#### 10.4.1 Developer registration

The developer registers their kit as an OAuth client on the KitStack dashboard:

```
KitStack Dashboard → Developer Settings → OAuth Clients

  + Register New Client

  Name:         Invoice Tracker
  Redirect URI: https://my-kit.example.com/callback

  → client_id:     ks_abc123
  → client_secret: ks_secret_...  (shown once)
```

This creates a row in the `oauth_clients` table (Turso): `{ clientId, clientSecret, name, redirectUri, developerId }`.

#### 10.4.2 User auth flow

```
User connects MCP client to developer's kit
    │
    ▼
MCP client hits /.well-known/oauth-authorization-server
    │ serve() returns KitStack as the authorization server
    │
    ▼
MCP client redirects to:
    https://kitstack.co/oauth/authorize
      ?client_id=ks_abc123
      &redirect_uri=https://my-kit.example.com/callback
      &scope=kit:invoice-tracker
    │
    ├── User has KitStack account → log in (BetterAuth)
    │
    └── User is new → sign up on kitstack.co
        │  (email + password, or GitHub/Google SSO)
        │
        ▼
    Consent screen:
    "Invoice Tracker wants to access your KitStack account"
    [Approve] [Deny]
        │
        ▼
    Redirect to developer's kit:
    https://my-kit.example.com/callback?code=authcode_xyz
        │
        ▼
    serve() exchanges code with KitStack API:
    POST https://kitstack.co/oauth/token
      { code, client_id, client_secret }
      → { access_token: "kat_...", user_id: "user_123", email: "user@example.com" }
        │
        ▼
    User authenticated. serve() has userId for all subsequent requests.
```

#### 10.4.3 What KitStack holds vs what the developer holds

| KitStack (identity provider) | Developer's server |
|---|---|
| User accounts (email, name, password hash) — BetterAuth | userId (opaque string) |
| OAuth client registrations | client_id + client_secret (env vars) |
| Authorization grants (user ↔ kit approvals) | Kit-specific data in their DB |
| Access/refresh tokens | No passwords, no PII |

The developer never sees a password. They get a `userId` and that's it.

#### 10.4.4 Database provisioning via KitStack (future)

For self-hosted kits using KitStack auth, KitStack can optionally provision a per-user Turso database — same as managed deployment. The access token response includes DB credentials:

```json
{
  "access_token": "kat_...",
  "user_id": "user_123",
  "kit_db": {
    "url": "libsql://invoice-tracker-user123.turso.io",
    "token": "eyJ..."
  }
}
```

`serve()` uses these credentials automatically. The developer's kit code doesn't change — `handler(db, args, ctx)` receives a pre-connected `db` scoped to the authenticated user.

This is the premium tier: "Use KitStack auth and we handle your users AND their databases. Just write your tools."

Out of scope for v1 — developers manage their own databases initially.

#### 10.4.5 Infrastructure additions for KitStack auth

| Component | What |
|-----------|------|
| `oauth_clients` table (Turso) | Stores registered OAuth clients (clientId, secret, redirectUri, developerId) |
| `/oauth/authorize` endpoint (kitstack.co) | Consent screen for third-party kit authorization |
| `/oauth/token` endpoint (kitstack.co) | Token exchange for third-party OAuth clients |
| KitStack Dashboard: Developer Settings → OAuth Clients | UI for registering/managing OAuth clients |

---

## 11. Dogfooding Strategy

The SDK is validated by migrating our own kits to use it — including the deployment pipeline. We don't just import the SDK types; we deploy our own kits through the same managed deployment infrastructure that third-party developers will use. This proves the full stack: SDK contract → build → deploy → proxied DB → runtime.

### 11.1 Migration plan for the Outreach kit

**Before (current):**

```typescript
// packages/mcp-server/src/kits/outreach/tools/create-sequence.ts
import { defineTool } from "../../../framework";

export const createSequence = defineTool({
  handler: async (db, args) => {
    // ...
    return { content: [{ type: "text" as const, text }] };
  },
});
```

**After (SDK):**

```typescript
// packages/mcp-server/src/kits/outreach/tools/create-sequence.ts
import { defineTool, kit } from "@kitstack/sdk";

export const createSequence = defineTool({
  handler: async (db, args, ctx) => {
    // ...
    return kit.text(text);
  },
});
```

**Changes required per kit:**
1. Replace `import { defineTool } from "../../../framework"` with `import { defineTool, kit } from "@kitstack/sdk"`
2. Replace `import { defineKit } from "../../../framework"` with `import { defineKit } from "@kitstack/sdk"`
3. Add `ctx` parameter to handlers (unused initially, but available)
4. Replace manual `{ content: [{ type: "text", text }] }` with `kit.text()` / `kit.error()`
5. Replace `import type { KitToolResult } from "../../../framework/types"` with `import type { KitToolResult } from "@kitstack/sdk"`

**The production framework becomes a thin wrapper:**
- `kit-runtime.ts` → imports `createKitHandler` from `@kitstack/sdk/runtime`, adds logging/observability
- `types.ts` → re-exports from `@kitstack/sdk`, plus production-only types (DynamoDB items, MCP protocol)
- `define-kit.ts`, `define-tool.ts` → deleted (use `@kitstack/sdk` directly)

### 11.2 Deploying first-party kits through the pipeline

After the SDK migration, first-party kits are deployed through the same pipeline that third-party kits will use. This replaces the hardcoded per-kit Lambdas in `infra/mcp.ts`.

**Before (current `infra/mcp.ts`):**

```typescript
// One SST function per kit, hardcoded
export const kitOutreach = new sst.aws.Function("KitOutreach", {
  ...kitLambdaDefaults,
  handler: "packages/mcp-server/src/kits/outreach/handler.handler",
});
// ... repeated for kitCrm, kitExpense, kitMeeting

// Router has explicit permissions for each
permissions: [
  { actions: ["lambda:InvokeFunction"], resources: [kitMeeting.arn, kitCrm.arn, ...] },
],
```

**After (dynamic deployment):**

```typescript
// infra/mcp.ts — no per-kit Lambdas, just the deployer infrastructure
export const kitBundlesBucket = new sst.aws.Bucket("KitBundles");

// Router gets wildcard permission for all Kit-* Lambdas
permissions: [
  { actions: ["lambda:InvokeFunction"], resources: ["arn:aws:lambda:*:*:function:Kit-*"] },
],
```

Kit Lambdas are created dynamically via the deployer (see 11.3), not declared in SST config.

### 11.3 Internal publishing workflow (admin)

An admin CLI script (`scripts/deploy-kit.ts`) handles what `kitstack publish` + review + approve does in a single step. This is the dogfood version — no review queue, no scanning, just build and deploy.

```
$ pnpm run deploy-kit packages/mcp-server/src/kits/outreach

  Building cold-outreach@1.0.0...
  ✓ Validation passed (8 tools)
  ✓ Bundle created (42 KB)
  ✓ Migration SQL valid

  Deploying...
  ✓ Bundle uploaded to S3 (kitstack-kit-bundles/cold-outreach/1.0.0/kit.mjs)
  ✓ Lambda created: Kit-cold-outreach-1-0-0
      Runtime: nodejs22.x, arm64, 256 MB, 30s
      IAM: lambda:InvokeFunction → McpRouter
  ✓ Kit registry updated (8 tools registered)

  Kit "Cold Outreach" is live.
```

**What the script does:**

```typescript
// scripts/deploy-kit.ts
import { build } from "@kitstack/sdk/build";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, GetFunctionCommand }
  from "@aws-sdk/client-lambda";
import { IAMClient } from "@aws-sdk/client-iam";

async function deployKit(kitEntryPath: string) {
  // 1. Build: validate + bundle with esbuild
  const { bundle, manifest } = await build(kitEntryPath);

  // 2. Upload bundle + app HTML to S3
  await s3.send(new PutObjectCommand({
    Bucket: "kitstack-kit-bundles",
    Key: `${manifest.kitId}/${manifest.version}/kit.mjs`,
    Body: bundle,
  }));

  // Upload view component modules (if any)
  for (const view of manifest.views ?? []) {
    if (!view.hasComponent) continue;
    const module = readFileSync(`.kitstack/build/views/${view.slug}.js`);
    await s3.send(new PutObjectCommand({
      Bucket: "kitstack-kit-bundles",
      Key: `${manifest.kitId}/${manifest.version}/views/${view.slug}.js`,
      Body: module,
      ContentType: "application/javascript",
    }));
  }

  // 3. Deploy Lambda (create or update)
  const functionName = `Kit-${manifest.kitId}-${manifest.version.replace(/\./g, "-")}`;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
    // Exists — update code
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: functionName,
      S3Bucket: "kitstack-kit-bundles",
      S3Key: `${manifest.kitId}/${manifest.version}/kit.mjs`,
    }));
  } catch {
    // Doesn't exist — create
    await lambda.send(new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
      Handler: "index.main",
      MemorySize: 256,
      Timeout: 30,
      Role: KIT_LAMBDA_ROLE_ARN, // Pre-created role: lambda:InvokeFunction on McpRouter only
      Code: {
        S3Bucket: "kitstack-kit-bundles",
        S3Key: `${manifest.kitId}/${manifest.version}/kit.mjs`,
      },
      Layers: [KIT_RUNTIME_LAYER_ARN], // @kitstack/sdk/runtime + @aws-sdk/client-lambda + @libsql/client
      Environment: { Variables: {} }, // Explicitly empty
    }));
  }

  // 4. Update kit registry in Turso
  for (const tool of manifest.tools) {
    await db.insert(kitRegistry).values({
      kitId: manifest.kitId,
      toolName: tool.name,
      toolDescription: tool.description,
      inputSchema: JSON.stringify(tool.inputSchema),
      lambdaArn: `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${functionName}`,
      kitName: manifest.kitName,
    }).onConflictDoUpdate(/* update ARN + description if tool already exists */);
  }

  // 5. Update kit views in Turso
  await db.delete(kitViews).where(eq(kitViews.kitId, manifest.kitId));
  for (const view of manifest.views ?? []) {
    await db.insert(kitViews).values({
      kitId: manifest.kitId,
      slug: view.slug,
      name: view.name,
      description: view.description,
      componentS3Key: view.hasComponent
        ? `${manifest.kitId}/${manifest.version}/views/${view.slug}.js`
        : null,
    });
  }
}
```

**Pre-requisites (one-time setup):**

| Resource | What | Created by |
|----------|------|-----------|
| S3 bucket `kitstack-kit-bundles` | Stores kit bundles | SST (`infra/mcp.ts`) |
| IAM role `KitLambdaRole` | `lambda:InvokeFunction` on McpRouter only | SST (`infra/mcp.ts`) |
| Lambda layer `KitRuntimeLayer` | `@kitstack/sdk/runtime` + `@aws-sdk/client-lambda` + `drizzle-orm` + `@libsql/client` | Built and published via CI |
| McpRouter `__dbProxy` handler | Proxies DB queries for sandboxed kits | `packages/mcp-server/src/router/handler.ts` |

### 11.4 Router changes for dynamic dispatch

The McpRouter's tool dispatcher currently uses a hardcoded Lambda ARN map:

```typescript
// Current: packages/mcp-server/src/router/tool-dispatcher.ts
const KIT_LAMBDA_MAP = {
  "cold-outreach": Resource.KitOutreach.name,
  "crm": Resource.KitCrm.name,
  // ...
};
```

After migration, it reads Lambda ARNs from the kit registry (Turso):

```typescript
// After: tool dispatcher reads ARN from registry
const registryItem = await getRegistryItem(toolName);
const lambdaArn = registryItem.lambdaArn;

// Dispatch differs based on whether kit is first-party or sandboxed
if (isFirstPartyKit(registryItem.kitId)) {
  // Direct invocation with dbUrl/dbToken (current model)
  await invokeKit(lambdaArn, { toolName, args, userId, kitId, dbUrl, dbToken });
} else {
  // Sandboxed invocation with invocation token (proxied DB)
  const invocationToken = nanoid();
  await cacheDbCredentials(invocationToken, { dbUrl, dbToken, userId, kitId });
  await invokeKit(lambdaArn, { toolName, args, userId, kitId, invocationToken, routerArn });
}
```

**For dogfooding:** Initially all kits (including first-party) can use the sandboxed path. This validates the proxied DB adapter under real load. Once proven, first-party kits can optionally use the direct path for lower latency — or just stay on the proxied path if the latency is acceptable.

### 11.5 Prototype validation results (CRM kit)

The CRM kit was rebuilt using the SDK pattern at `packages/kits/crm/` with a minimal SDK stub at `packages/sdk-stub/`. This prototype validated the SDK design before building the SDK itself.

**What was built:**
- 10-file SDK stub (`packages/sdk-stub/`) — types, factory functions (`defineKit`, `defineTool`, `defineView`, `defineLoader`), result helpers (`kit.text()`, `kit.error()`), view hooks (`useKit`, `useTool`, `useFile`)
- 41-file CRM kit (`packages/kits/crm/`) — `kit.config.ts`, 11 tools, 3 shared query modules, 5 views (loader + component + index + main), schema/migrations/instructions
- Lambda handler bridging SDK `(db, args, ctx)` signature to the existing `KitToolInvocation` format

**Type-check validation:** `tsc --noEmit` passes with zero errors across all 51 files. Confirms:
- `LoaderData<typeof contactsView>` resolves to the correct enriched type (contacts + `dealCount` + `lastActivityAt`)
- `LoaderData<typeof pipelineView>` includes `contactName` from the left join
- `LoaderData<typeof dashboardView>` includes computed `total`, `open`, `won` summaries
- Drizzle `$inferSelect` produces camelCase field names (`lastContactedAt`, not `last_contacted_at`)
- Shared queries callable from both tools and loaders with matching types
- View hooks (`useKit`, `useTool`, `useFile`) compose correctly

**Production validation:** The CRM kit's tools were deployed via `infra/mcp.ts` pointing to `packages/kits/crm/handler.handler`. Tested end-to-end with Claude in Claude.ai:
- All 11 tools work: add_contact, list_contacts, search_contacts, add_deal, list_deals, update_deal, add_activity, get_contact_detail, pipeline_dashboard, generate_proposal, export
- Progressive disclosure (`kit()` → `kit(id)` → `kit(id, cmd, params)`) validated as natural for LLMs
- Result helpers (`kit.text()`, `kit.notFound()`) produce correct MCP responses
- Shared queries (`getDealsWithContacts`, `getPipelineSummary`) used by tools return correct data
- Existing views (in `packages/mcp-apps/src/crm/`) continue to work — no regression

**Lessons learned:**
- List tools must include entity IDs in output for LLMs to chain operations (see section 2.4.1)
- Tools with `z.object({})` args may receive `undefined` — runtime should normalize to `{}`
- The `(db, args, ctx)` handler signature works seamlessly — `ctx` is available but tools that don't need it simply ignore it
- Shared queries between tools and loaders eliminate code duplication without type gymnastics
- `kit.config.ts` as "table of contents" is clean and readable — all imports visible at a glance

**What's NOT validated yet:**
- View loader execution at runtime (views still use old `useAppData` + AppData Lambda flow)
- Shell integration with pre-loaded loader data
- `useKit()` / `useTool()` / `useFile()` hooks at runtime (type-checked only)
- `kitstack dev --stdio` local development
- `createTestKit()` unit testing

### 11.6 Validation checklist

Before the SDK is v0.1.0:
- [ ] All 4 first-party kits (outreach, CRM, expense, meeting) import from `@kitstack/sdk`
- [ ] All existing tests pass with the SDK types and runtime
- [ ] `kitstack dev --stdio` runs the outreach kit locally and handles tool calls
- [ ] `createTestKit(outreachKit)` works in unit tests
- [ ] `kitstack init test-kit` scaffolds a working project
- [ ] `kitstack build` validates and bundles a kit
- [ ] McpRouter `__dbProxy` handler processes queries from sandboxed Lambdas
- [ ] `pnpm run deploy-kit` deploys the outreach kit as a dynamic Lambda
- [ ] Deployed kit handles tool calls end-to-end (LLM → router → kit Lambda → proxied DB → Turso)
- [ ] Per-kit hardcoded Lambdas removed from `infra/mcp.ts`

---

## 12. Phasing

### Phase 1 — SDK core + deployment plumbing (dogfood)

**Goal:** Extract the SDK, build the deployment pipeline, deploy first-party kits through it.

**Deliverables:**

SDK contract:
- `packages/sdk/` with `defineKit`, `defineTool`, `defineView`, `defineLoader`, `kit` result helpers, `LoaderData` type, validation, `zodToJsonSchema`
- `@kitstack/sdk/testing` with `createTestKit()`
- `@kitstack/sdk/runtime` with `createKitHandler()` + `createProxiedDbClient()`
- `@kitstack/sdk/errors` with error hierarchy

Deployment plumbing:
- S3 bucket for kit bundles (`infra/mcp.ts`)
- IAM role for sandboxed kit Lambdas (`infra/mcp.ts`)
- Lambda runtime layer (`@kitstack/sdk/runtime` + deps)
- McpRouter `__dbProxy` handler branch
- Invocation token lifecycle in OAuthStore
- `scripts/deploy-kit.ts` — admin script to build + deploy a kit
- Router tool dispatcher reads ARNs from kit registry (no hardcoded map)
- McpRouter IAM wildcard for `Kit-*` Lambdas

Router changes:
- `kit-handler.ts` reads `VIEW_DATA` from kit registry (Turso) instead of hardcoded map
- `app-resources.ts` reads `KIT_APPS` from kit registry instead of hardcoded map
- `kit-handler.ts` `handleKitViewCall()` builds embedded resource from registry data (view slug → execute loader in kit Lambda → serialize data → build response)

Dogfood:
- Outreach kit migrated to SDK imports (including `defineView` for sequence-builder, prospect-list, email-preview)
- Outreach kit deployed via `deploy-kit` script as a dynamic Lambda
- View metadata registered in `kit_views` table (description per view, loaders bundled in kit code)
- All existing tests pass
- Remove `KitOutreach` hardcoded Lambda from SST config

### Phase 2 — Full migration + CLI

**Goal:** All kits deployed through the pipeline. External developers can create and test kits locally.

**Deliverables:**
- Remaining 3 kits (CRM, expense, meeting) migrated to SDK + deployed via pipeline
- All per-kit hardcoded Lambdas removed from `infra/mcp.ts`
- `kitstack init` — scaffold a new kit
- `kitstack dev --stdio` — local MCP server for Claude Desktop/Code
- `kitstack build` — validate and bundle

### Phase 3 — CLI auth + relay

**Goal:** Any LLM client can connect to a dev kit via the relay.

**Deliverables:**
- `kitstack login` — browser-based auth flow
- CLI auth page (`src/app/cli/authorize/page.tsx`)
- Token generation endpoint
- `kitstack dev` (relay mode) — internally uses `serve({ relay: {...} })`, connects to `wss://relay.kitstack.co`
- WebSocket API Gateway (`DevRelay`) + three Lambda handlers
- `POST /dev/{sessionId}` route in McpRouter

### Phase 4 — Public marketplace

**Goal:** Third-party developers can publish kits. `kitstack publish` is gated behind approval while automation is built.

**Deliverables:**
- `kitstack publish` command (gated: requires developer approval flag in DB)
- `kit_submissions` table in Turso (tracks submissions, status, check results)
- Automated scanner Lambda (static analysis + migration validation, triggered by S3 upload)
- Admin dashboard (`/admin/kit-submissions`) — review UI with approve/reject/test
- Staging deployment (test button deploys kit to a staging Lambda with test DB)
- Approval workflow triggers `deploy-kit` logic (same as internal script, now automated)
- Developer notification on status changes (email or webhook)

### Phase 5 — Self-hosted runtime + auth

**Goal:** Developers can self-host kits with `serve()`. KitStack available as identity provider.

**Deliverables:**
- `@kitstack/sdk/server` with `serve()` — full MCP server (protocol, two-tool split, loaders, DB, auth)
- Auth adapters: `"none"`, `kitstack()`, `oauth()`
- Monolith mode: `serve({ kits: [...] })` with multi-kit routing
- Production relay mode via `serve({ relay: {...} })`
- OAuth client registration in KitStack dashboard
- KitStack consent screen (`/oauth/authorize` for third-party kit clients)
- Container deployment guide (Dockerfile, Fly.io, Railway)

### Phase 6 — Polish

**Goal:** Production-ready for external developers.

**Deliverables:**
- `kitstack validate` — comprehensive pre-publish checks
- `--watch` mode for `kitstack dev` (hot reload on file changes)
- Versioned migrations (numbered migration files)
- Final documentation pass (compile dev notes into complete docs — see section 13)
- Changesets for automated versioning
- Ungated `kitstack publish` (automated scanning replaces manual approval for trusted developers)
- KitStack DB provisioning for self-hosted kits using KitStack auth (premium feature)

---

## 13. Documentation Strategy

### 13.1 Principle: document as we build

Documentation is written alongside the code, not after. Each phase produces dev notes that capture what was built, what was learned (gotchas, protocol quirks, design decisions), and how to use it. These notes accumulate in `docs/sdk/` and serve two purposes:
1. **During development:** Working reference for ourselves — what works, what doesn't, what changed
2. **After stabilization:** Raw material for the published documentation

### 13.2 Per-phase dev notes

After completing each phase, write a dev note at `docs/sdk/notes-phase-{N}.md` covering:

**What we built:**
- New APIs, types, CLI commands — with real code examples from our kits (not hypothetical)
- Architecture decisions made during implementation (especially where we deviated from this plan)

**What we learned:**
- Gotchas, edge cases, protocol quirks (like the MCP Apps lessons in `docs/mcp-apps.md`)
- Things that were harder or easier than expected
- API surface that felt wrong and was changed mid-phase

**How to use it:**
- Working usage examples pulled from our migrated first-party kits
- Test patterns that proved useful
- Common mistakes and how to avoid them

**Phase-specific notes:**

| Phase | Key documentation topics |
|-------|------------------------|
| Phase 1 | SDK contract (`defineKit`, `defineTool`, `defineView`, `kit.*` helpers). `createTestKit()` patterns. `createKitHandler()` usage. Proxied DB adapter behavior. How to migrate a kit from framework to SDK. |
| Phase 2 | CLI commands (`init`, `dev --stdio`, `build`). Scaffolded project walkthrough. Local dev workflow end-to-end. View rendering in dev mode (two-tool split locally). |
| Phase 3 | `kitstack login` flow. Relay architecture. Connecting any LLM client. Dev vs production relay sessions. WebSocket reconnection behavior. |
| Phase 4 | `kitstack publish` workflow. What the scanner checks. Review process. How sandboxed deployment works. Invocation token lifecycle. |
| Phase 5 | `serve()` API. Auth adapters (`kitstack()`, `oauth()`). Monolith mode. Container deployment. KitStack as identity provider flow. |
| Phase 6 | Migration versioning. Advanced patterns. Final polish. |

### 13.3 Inline API documentation

All public SDK exports get TSDoc comments with `@example` blocks at the time they're written (not retroactively). The examples should be real — copied from our first-party kits, not invented:

```typescript
/**
 * Define a view for interactive UI rendering via MCP Apps.
 *
 * Views appear in the `kit_view` tool. The LLM chooses when to show
 * them based on the `description` field. The universal app shell
 * renders data from the view's loader
 * for tables, lists, and markdown.
 *
 * @example
 * ```typescript
 * defineView({
 *   slug: "sequence-builder",
 *   name: "Sequence Builder",
 *   description: "after creating or editing sequences and emails",
 *   loader,  // server-side data function
 * })
 * ```
 */
export function defineView(config: ViewConfig): ViewDefinition
```

### 13.4 Final documentation pass (Phase 5)

When the SDK is stable and major bugs are fixed, compile the dev notes into published documentation. This is a dedicated effort, not an afterthought.

**Input:**
- Dev notes from all phases (`docs/sdk/notes-phase-*.md`)
- TSDoc on all public APIs
- This architecture plan (for high-level narrative)
- Gotchas docs like `docs/mcp-apps.md` (for "lessons learned" sections)
- Our migrated first-party kits (for real-world examples)

**Output: `docs.kitstack.dev`**

| Page | Content |
|------|---------|
| Getting Started | `kitstack init` → `kitstack dev --stdio` → connect to Claude Desktop. 5-minute quickstart. |
| Kit Anatomy | `defineKit`, `defineTool`, `defineView`, schema, migrations, instructions. Full reference with examples from the outreach kit. |
| Testing | `createTestKit()`, `call()`, `callAs()`, `reset()`, DB assertions. Patterns and anti-patterns. |
| Views | How MCP Apps work. `defineView` with `loader` + `component`. End-to-end type safety (schema → loader → view). |
| CLI Reference | `init`, `dev`, `build`, `login`, `publish`. Flags, config, examples. |
| Deployment | Managed vs self-hosted. What the sandbox does. How the proxied DB works. |
| Migration Guide | How to move from `packages/mcp-server/src/framework/` to `@kitstack/sdk`. Step-by-step with diffs. |
| Error Reference | All error codes, what triggers them, how to fix. Generated from `errors.ts`. |
| Architecture | How it all fits together. Data flow diagrams. What the SDK owns vs the platform. |

**What we don't write until Phase 5:**
- Marketing-oriented landing pages
- API reference site (auto-generated from TSDoc via TypeDoc or similar)
- Video tutorials

**What we DO write from Phase 1:**
- Dev notes (mandatory per phase)
- TSDoc on public APIs (mandatory per export)
- This plan (updated as we go)

---

## 14. What the SDK does NOT own

These concerns stay in the production framework or platform:

| Concern | Where it lives | Why |
|---------|---------------|-----|
| OAuth (MCP auth) | `packages/mcp-server/src/router/oauth/` | Protocol-level, not kit-level |
| Two-tool split (`kit` + `kit_view`) | `packages/mcp-server/src/router/kit-handler.ts` | MCP Apps protocol constraint — platform concern |
| Onion routing (`kit()` meta-tool) | `packages/mcp-server/src/router/kit-handler.ts` | Multi-kit dispatch is a platform concern |
| App shell HTML | `packages/mcp-apps/` → S3 `KitAssets` bucket | Universal shell is a platform asset, not per-kit |
| Embedded resource construction | `packages/mcp-server/src/router/kit-handler.ts` | Building the `{ type: "resource", resource: { ... } }` content block is router logic |
| `_meta.ui.resourceUri` on tool definition | `packages/mcp-server/src/router/mcp-protocol.ts` | Protocol-level capability negotiation |
| postMessage protocol | App shell ↔ MCP host | MCP Apps spec, not SDK concern |
| Database provisioning (Turso API) | `packages/mcp-server/src/framework/db-provisioner.ts` | Cloud infrastructure |
| DynamoDB operations | `packages/mcp-server/src/framework/dynamo.ts` | Production storage |
| Observability (PostHog, OTLP) | `packages/mcp-server/src/framework/logger.ts` | Production logging |
| Rate limiting | `packages/mcp-server/src/router/handler.ts` | Platform-level enforcement |
| Kit activation/deactivation | `src/services/kit-activation.service.ts` | Platform business logic |
| Subscription management | `src/services/subscription.service.ts` | Payment/billing |

### What the SDK DOES own for views

| Concern | Where it lives | Why |
|---------|---------------|-----|
| View definition (`defineView`, `ViewDefinition`) | `@kitstack/sdk` | Kit declares its own views, descriptions, and data commands |
| View validation (slug format, loader is a function, component path exists) | `@kitstack/sdk` (in `defineKit` validation) | Catch errors at build time |
| View metadata in manifest | `@kitstack/sdk` (in `kitstack build`) | View data flows from kit definition → manifest → registry |
| Local view rendering in dev mode | `@kitstack/sdk/runtime` (in `dev-server.ts`) | Dev server implements the two-tool split locally |
| View component builds | `@kitstack/sdk` (in `kitstack build`) | When `component` is set, SDK builds React entry into an ES module (vite, same chunking as first-party views) |

---

## 15. Implementation Sequence

This section maps the phases (section 12) to a concrete sequence of implementation steps. Each step produces a testable artifact — no step depends on later steps, and each step builds on the previous one.

### Phase 1 — SDK core + deployment plumbing

```
Step 1: SDK package scaffold
  Create packages/sdk/ with package.json, tsconfig, tsup config
  Set up subpath exports (., /testing, /runtime, /server, /authz, /errors)
  Run publint + attw in CI
  ✓ Artifact: empty SDK package that builds and passes lint

Step 2: Core types + define functions
  Port types.ts from framework (KitDefinition, ToolDefinition, KitToolResult, KitContext)
  Add ViewDefinition, LoaderFn, LoaderData
  Implement defineKit(), defineTool(), defineView(), defineLoader()
  Implement kit.text(), kit.error(), kit.json(), kit.notFound(), etc.
  Implement validation (snake_case, descriptions, duplicate names)
  ✓ Artifact: defineKit(outreachKit) compiles and validates

Step 3: Testing framework
  Implement createTestKit() with in-memory SQLite
  call(), callAs(), reset(), cleanup()
  Write tests for the outreach kit using createTestKit()
  ✓ Artifact: vitest tests pass for outreach kit tools

Step 4: Kit runtime
  Implement createKitHandler() — Lambda handler factory
  Port zodToJsonSchema() from shared
  Port kit-db.ts (createKitDbClient)
  ✓ Artifact: createKitHandler(outreachKit) returns a working Lambda handler

Step 5: Migrate outreach kit to SDK
  Replace framework imports with @kitstack/sdk imports
  Add kit.config.ts to outreach kit
  Add ctx parameter to handlers
  Replace manual KitToolResult construction with kit.text()/kit.error()
  Add defineView() for sequence-builder, prospect-list, email-preview
  Add loaders for each view
  Verify all existing tests still pass
  ✓ Artifact: outreach kit compiles with SDK, tests pass

Step 6: Deployment infrastructure
  Add S3 bucket (KitBundles) to infra/mcp.ts
  Create IAM role (KitLambdaRole) with lambda:InvokeFunction on McpRouter
  Build Lambda runtime layer (SDK runtime + deps)
  Add McpRouter __dbProxy handler branch
  Add invocation token lifecycle in OAuthStore
  Add wildcard IAM for Kit-* Lambdas on McpRouter
  ✓ Artifact: infrastructure deployed via sst deploy

Step 7: Dynamic kit deployment
  Implement scripts/deploy-kit.ts (build + S3 upload + Lambda create + registry update)
  Update McpRouter tool dispatcher to read ARNs from kit registry
  Update kit-handler.ts to read VIEW_DATA from kit registry
  Update app-resources.ts to read KIT_APPS from kit registry
  Deploy outreach kit via deploy-kit script
  Remove KitOutreach hardcoded Lambda from SST config
  End-to-end test: LLM → router → dynamic Lambda → proxied DB → Turso
  ✓ Artifact: outreach kit running as dynamic Kit-cold-outreach Lambda

Step 8: Dev notes
  Write docs/sdk/notes-phase-1.md
  Document what changed from the plan, gotchas, working examples
```

### Phase 2 — Full migration + CLI

```
Step 9: Migrate remaining kits
  CRM, expense, meeting kits → SDK imports + kit.config.ts + loaders
  Deploy each via deploy-kit script
  Remove all per-kit hardcoded Lambdas from infra/mcp.ts
  ✓ Artifact: all 4 kits running as dynamic Lambdas

Step 10: CLI scaffold
  Implement kitstack CLI entry point (commander or citty)
  kitstack init — scaffold new kit project from templates
  kitstack build — validate + esbuild bundle + view component builds + manifest
  ✓ Artifact: kitstack init test-kit creates a working project

Step 11: Local dev server
  kitstack dev --stdio — uses serve() internally with auth: "none" and local SQLite
  Registers kit tools + kit_view, handles loaders, serves app shell
  Test: connect Claude Desktop, call tools, trigger views
  ✓ Artifact: kitstack dev --stdio runs outreach kit locally

Step 12: Dev notes
  Write docs/sdk/notes-phase-2.md
```

### Phase 3 — CLI auth + relay

```
Step 13: Developer auth
  Build CLI authorize page (src/app/cli/authorize/page.tsx)
  Build token generation endpoint (src/app/api/cli/token/route.ts)
  Implement kitstack login (browser flow, localhost callback, save credentials)
  ✓ Artifact: kitstack login saves token to ~/.kitstack/credentials.json

Step 14: Relay infrastructure
  Add WebSocket API Gateway (DevRelay) to infra/mcp.ts
  Implement $connect, $disconnect, $default Lambda handlers
  Add POST /dev/{sessionId} relay route to McpRouter
  ✓ Artifact: WebSocket relay deployed and accepting connections

Step 15: Relay client
  Implement relay-client.ts (WebSocket connection, reconnect with backoff)
  kitstack dev (default mode) connects to relay, prints public URL
  Test: connect Claude.ai to relay URL, call tools, trigger views
  ✓ Artifact: kit accessible from any LLM client via public URL

Step 16: Dev notes
  Write docs/sdk/notes-phase-3.md
```

### Phase 4 — Public marketplace

```
Step 17: Submission pipeline
  Add kit_submissions table to Turso
  Implement kitstack publish (upload bundle + manifest to S3, create submission row)
  Gate behind developer approval flag
  ✓ Artifact: kitstack publish uploads kit, creates pending submission

Step 18: Automated scanning
  Implement scanner Lambda (static analysis, npm audit, migration SQL validation)
  Trigger on S3 upload
  Store scan results on submission row
  ✓ Artifact: submissions auto-scanned, results visible

Step 19: Admin review
  Build admin dashboard (/admin/kit-submissions)
  View bundle, view manifest, view scan results
  Test button: deploy staging Lambda + test DB
  Approve/reject buttons
  ✓ Artifact: admin can review and approve submissions

Step 20: Approval workflow
  Approve triggers deploy-kit logic (Lambda creation, registry update)
  Kit appears in marketplace
  Notify developer on status change
  ✓ Artifact: approved kit is live and usable by marketplace users

Step 21: Dev notes
  Write docs/sdk/notes-phase-4.md
```

### Phase 5 — Self-hosted runtime + auth

```
Step 22: serve() core
  Implement @kitstack/sdk/server with MCP protocol handler
  Two-tool split (kit + kit_view), loader execution, view serving
  HTTP + stdio transports
  DB connection management (single kit, multi-kit)
  auth: "none" adapter
  ✓ Artifact: serve({ kit, auth: "none", db: {...} }) runs a working MCP server

Step 23: Relay integration
  serve({ relay: {...} }) connects to KitStack relay
  Production relay sessions (PROD_SESSION, no TTL, health checks)
  ✓ Artifact: self-hosted kit accessible via KitStack relay

Step 24: KitStack identity provider
  Add oauth_clients table to Turso
  Build developer OAuth client registration in dashboard
  Build consent screen (/oauth/authorize for third-party clients)
  Build token exchange endpoint (/oauth/token for third-party clients)
  Implement kitstack() auth adapter in SDK
  ✓ Artifact: serve({ auth: kitstack({...}) }) authenticates users via KitStack

Step 25: Custom OAuth adapter
  Implement oauth() auth adapter
  Developer provides authorize + validateToken
  ✓ Artifact: serve({ auth: oauth({...}) }) works with custom auth

Step 26: Monolith mode
  serve({ kits: [...], databases: {...} }) with multi-kit onion routing
  ✓ Artifact: multiple kits running in single process

Step 27: Dev notes + container guide
  Write docs/sdk/notes-phase-5.md
  Dockerfile example, Fly.io deployment guide
```

### Phase 6 — Polish

```
Step 28: Developer experience polish
  kitstack validate — comprehensive pre-publish checks
  kitstack dev --watch — hot reload on file changes
  Versioned migrations (_kitstack_migrations table, numbered files)

Step 29: Documentation
  Final pass: compile all phase notes into docs.kitstack.dev
  Getting Started, Kit Anatomy, Testing, Views, CLI, Deployment, Migration Guide
  Auto-generate error reference from errors.ts
  TSDoc → API reference via TypeDoc

Step 30: Release tooling
  Changesets for automated versioning
  CI: build → lint → test → publish
  Ungated kitstack publish for trusted developers

Step 31: KitStack DB provisioning (premium)
  Token response includes kit_db credentials for self-hosted kits
  serve() auto-connects to provisioned per-user databases
  ✓ Artifact: self-hosted kits with KitStack-managed databases
```

### Dependency graph

```
Phase 1: [1] → [2] → [3] → [4] → [5] → [6] → [7]
              types   test   runtime  migrate  infra  deploy

Phase 2: [9] → [10] → [11]
          migrate  CLI    dev-server

Phase 3: [13] → [14] → [15]
          auth     relay   client

Phase 4: [17] → [18] → [19] → [20]
          submit   scan    review   approve

Phase 5: [22] → [23] → [24] → [25] → [26]
          serve    relay   kitstack  oauth  monolith

Phase 6: [28] → [29] → [30] → [31]
          polish   docs    release   premium

Phases 1-2 are sequential (each step builds on the previous).
Phases 3-5 can overlap — relay (3), marketplace (4), and self-hosted (5)
are independent workstreams once Phase 2 is complete.
Phase 6 runs after 3-5 are stable.
```
