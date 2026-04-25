import type { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

// --- Context ---

/**
 * Runtime context passed to every tool handler and loader invocation.
 *
 * Provides identity (`userId`) and kit scoping (`kitId`) without coupling
 * to infrastructure. In production the router populates this from the
 * authenticated session; in tests and dev mode, defaults are used.
 *
 * @example
 * ```typescript
 * // Inside a tool handler — ctx is injected by the runtime
 * handler: async (db, args, ctx) => {
 *   const rows = await db.select().from(contacts)
 *     .where(eq(contacts.ownerId, ctx.userId));
 *   return kit.json(rows);
 * }
 * ```
 */
export interface KitContext {
  userId: string;
  kitId: string;
  params?: Record<string, string>;
}

// --- Tool Result ---

/**
 * A single content block in a {@link KitToolResult}.
 *
 * Text blocks carry LLM-readable output. Resource blocks carry embedded
 * resources (e.g. the MCP Apps HTML shell with MIME type
 * `text/html;profile=mcp-app`).
 */
export type KitToolContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

/**
 * The return type of every tool handler. Wraps one or more content blocks
 * with an optional error flag.
 *
 * Use the {@link kit} result helpers (`kit.text()`, `kit.error()`,
 * `kit.json()`, etc.) instead of constructing this manually.
 *
 * @example
 * ```typescript
 * // Successful result (via kit.text helper)
 * return kit.text(`Contact "${args.name}" added (ID: ${id}).`);
 *
 * // Error result (via kit.error helper)
 * return kit.error(`Contact with id "${args.id}" not found`);
 * ```
 */
export interface KitToolResult {
  content: KitToolContentBlock[];
  isError?: boolean;
}

// --- Authorization ---

/**
 * A single authorization requirement returned by a tool's `authorize` hook.
 * The runtime checks each requirement against the authz engine before
 * calling the tool handler.
 *
 * @example
 * ```typescript
 * authorize: (args, ctx) => [
 *   { relation: "owner", objectType: "sequence", objectId: args.sequenceId },
 * ]
 * ```
 */
export interface AuthzRequirement {
  relation: string;
  objectType: string;
  objectId: string;
}

// --- Tool Definition ---

export interface ToolBase {
  name: string;
  description: string;
  args: z.ZodType;
  authorize?: (args: any, ctx: KitContext) => AuthzRequirement[];
}

/** Tool with load() (handler auto-generated if omitted) */
interface ToolWithLoad extends ToolBase {
  load: (db: LibSQLDatabase, args: any, ctx: KitContext) => Promise<any>;
  handler?: (db: LibSQLDatabase, args: any, ctx: KitContext) => Promise<KitToolResult>;
}

/** Tool with handler() only (no data layer) */
interface ToolHandlerOnly extends ToolBase {
  load?: undefined;
  handler: (db: LibSQLDatabase, args: any, ctx: KitContext) => Promise<KitToolResult>;
}

/**
 * A tool definition created by {@link defineTool}. Must have at least
 * `load()` or `handler()`. Tools with only `load()` get an auto-generated
 * handler that returns `kit.json(data)`.
 *
 * @example
 * ```typescript
 * // Read tool with load + handler (CRM kit)
 * const listContacts = defineTool({
 *   name: "list_contacts",
 *   description: "List all contacts in the CRM",
 *   args: z.object({ limit: z.number().optional().describe("Max results") }),
 *   load: loadContacts,
 *   handler: async (db, args, ctx) => {
 *     const data = await loadContacts(db, args, ctx);
 *     return kit.text(formatTable(data));
 *   },
 * });
 *
 * // Write tool with handler only
 * const addContact = defineTool({
 *   name: "add_contact",
 *   description: "Add a new contact to the CRM",
 *   args: z.object({ name: z.string() }),
 *   handler: async (db, args, ctx) => {
 *     await db.insert(contacts).values({ id: nanoid(), name: args.name });
 *     return kit.text(`Contact "${args.name}" added.`);
 *   },
 * });
 * ```
 */
export type ToolDefinition = ToolWithLoad | ToolHandlerOnly;

// --- Loader ---

/**
 * A server-side data function for a view. Receives the database and context,
 * returns typed data that becomes the view component's props.
 *
 * Create loaders with {@link defineLoader}.
 */
export type LoaderFn = (
  db: LibSQLDatabase,
  ctx: KitContext
) => Promise<unknown>;

/**
 * Extract the return type from a view definition's loader.
 *
 * @example
 * ```typescript
 * import type { LoaderData } from "@kitstack/sdk";
 * import contactsView from "./views/contacts";
 *
 * type Data = LoaderData<typeof contactsView>;
 * // Data is the resolved return type of the contacts loader
 * ```
 */
export type LoaderData<T extends { loader: LoaderFn }> = Awaited<
  ReturnType<T["loader"]>
>;

/**
 * Extract the return type from a loader or load function. Shorthand for
 * `Awaited<ReturnType<typeof fn>>`.
 *
 * @example
 * ```typescript
 * import type { Infer } from "@kitstack/sdk";
 * import { loader } from "./loader";
 *
 * // In a view component
 * function ContactsView({ data }: { data: Infer<typeof loader> }) {
 *   return <ul>{data.map(c => <li key={c.id}>{c.name}</li>)}</ul>;
 * }
 * ```
 */
export type Infer<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

// --- View Definition ---

/**
 * A view definition created by {@link defineView}. Views are interactive
 * UI surfaces rendered inside the LLM client as sandboxed iframes via
 * MCP Apps (`text/html;profile=mcp-app`).
 *
 * Each view has a server-side `loader` (data function) and a client-side
 * `component` (React). Types flow end-to-end: schema -> tool.load() ->
 * loader -> `Infer<typeof loader>` -> component props.
 *
 * @example
 * ```typescript
 * import { defineView } from "@kitstack/sdk";
 * import { loader } from "./loader";
 * import { ContactsView } from "./View";
 *
 * export default defineView({
 *   slug: "contacts",
 *   name: "Contacts",
 *   description: "after adding or updating contacts",
 *   loader,
 *   component: ContactsView,
 *   height: 500,
 * });
 * ```
 */
export interface ViewDefinition<TLoader extends LoaderFn = LoaderFn> {
  slug: string;
  name: string;
  description: string;
  loader: TLoader;
  component: React.ComponentType<{ data: Awaited<ReturnType<TLoader>> }>;
  height?: number;
  permissions?: {
    clipboardWrite?: boolean;
  };
}

// --- Kit Definition ---

/**
 * The top-level kit configuration created by {@link defineKit}. This is
 * the single entry point that wires together tools, views, schema,
 * migrations, and instructions.
 *
 * @example
 * ```typescript
 * // kit.config.ts — the CRM kit's table of contents
 * import { defineKit } from "@kitstack/sdk";
 * import * as schema from "./src/schema";
 * import { migrationSql } from "./src/migrations";
 * import { crmInstructions } from "./src/instructions";
 * import { addContact } from "./src/tools/add-contact";
 * import { listContacts } from "./src/tools/list-contacts";
 * import contactsView from "./src/views/contacts";
 *
 * export default defineKit({
 *   id: "crm",
 *   version: "1.0.0",
 *   name: "CRM Kit",
 *   description: "Full CRM with contacts, deals, and pipeline",
 *   schema,
 *   migrationSql,
 *   instructions: crmInstructions,
 *   tools: [addContact, listContacts],
 *   views: [contactsView],
 * });
 * ```
 */
export interface KitDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
  views?: ViewDefinition<any>[];
}
