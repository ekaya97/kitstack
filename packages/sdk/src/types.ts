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
  /**
   * Sample data matching the loader's return type, used by the DevKit
   * preview when the database is empty. Stripped from production builds
   * by {@link defineKit} — never shipped to Lambda.
   */
  placeholder?: Awaited<ReturnType<TLoader>>;
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
  /**
   * Raw SQL migration statements, separated by `;`.
   * Use this when not using Drizzle (e.g. Prisma, hand-written SQL).
   * If omitted, the SDK reads `.sql` files from `migrationsDir`.
   * At least one of `migrationSql` or `migrationsDir` should be provided.
   */
  migrationSql?: string;
  /**
   * Path to a directory containing numbered `.sql` migration files
   * (e.g. drizzle-kit output). Files are applied in alphabetical order.
   * If omitted, falls back to `migrationSql`.
   */
  migrationsDir?: string;
  instructions: string;
  /**
   * Semantic keywords for LLM intent routing. Lowercase, single words
   * or hyphenated terms that help the LLM match user requests to this kit
   * without needing to call `kit()` first.
   *
   * @example `["contact", "deal", "pipeline", "proposal", "follow-up"]`
   */
  triggers?: string[];
  tools: ToolDefinition[];
  views?: ViewDefinition<any>[];
  /**
   * View placeholder data extracted from view definitions by
   * {@link defineKit}. Keyed by view slug. Used by the DevKit server
   * only — not included in production builds.
   * @internal
   */
  _placeholders?: Record<string, unknown>;
}

// --- Agent Definition ---

/** A versioned instruction bundle supplied to an autonomous agent run. */
export interface AgentInstructions {
  version: string;
  content: string;
}

/** The single trigger identity an agent is allowed to run under. */
export interface AgentTrigger {
  id: string;
  identity: string;
}

/** Session state shared by a turn source, model connector, and tools. */
export interface AgentSession<TContext extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  context: TContext;
}

/** A provider-neutral input produced by the injected turn source. */
export interface AgentInput {
  content: string;
  metadata?: Readonly<Record<string, unknown>>;
}

/** In-memory conversation entries passed to the model connector. */
export type AgentMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; toolCallId: string; name: string; result: unknown; isError?: boolean };

/** A finite tool that can be invoked by an agent model response. */
export interface AgentToolDefinition<TContext extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  execute: (args: unknown, session: AgentSession<TContext>, signal: AbortSignal) => Promise<unknown>;
}

/** A model response: either emit a message or request one declared tool. */
export type AgentModelResponse =
  | { type: "message"; content: string; terminal?: boolean }
  | { type: "tool_call"; toolCallId?: string; name: string; args: unknown };

/** Input contract for a provider/model connector. */
export interface AgentModelTurn<TContext extends Record<string, unknown> = Record<string, unknown>> {
  session: AgentSession<TContext>;
  instructions: AgentInstructions;
  tools: readonly AgentToolDefinition<TContext>[];
  history: readonly AgentMessage[];
  input?: AgentInput;
  signal: AbortSignal;
}

export interface AgentModelConnector<TContext extends Record<string, unknown> = Record<string, unknown>> {
  turn: (request: AgentModelTurn<TContext>) => Promise<AgentModelResponse>;
}

export interface AgentTurnSource<TContext extends Record<string, unknown> = Record<string, unknown>> {
  next: (request: { session: AgentSession<TContext>; signal: AbortSignal }) => Promise<AgentInput | null>;
}

/** Output delivered to the injected channel bridge (voice, SMS, etc.). */
export interface AgentOutput<TContext extends Record<string, unknown> = Record<string, unknown>> {
  session: AgentSession;
  content: string;
  terminal: boolean;
}

export interface AgentOutputSink<TContext extends Record<string, unknown> = Record<string, unknown>> {
  emit: (output: AgentOutput<TContext> & { session: AgentSession<TContext> }) => Promise<void>;
}

/** Metadata-only lifecycle events. These deliberately contain no content, prompts, or tool data. */
export type AgentLifecycleEvent =
  | {
      type: "run_started";
      kitId: string;
      agentId: string;
      triggerId: string;
      triggerIdentity: string;
      sessionId: string;
      instructionsVersion: string;
      at: number;
    }
  | {
      type: "turn_started";
      kitId: string;
      agentId: string;
      sessionId: string;
      turn: number;
      at: number;
    }
  | {
      type: "turn_finished";
      kitId: string;
      agentId: string;
      sessionId: string;
      turn: number;
      outcome: "message" | "tool_call" | "error";
      durationMs: number;
      at: number;
    }
  | {
      type: "tool_called";
      kitId: string;
      agentId: string;
      sessionId: string;
      turn: number;
      toolName: string;
      outcome: "completed" | "failed" | "rejected";
      durationMs: number;
      at: number;
    }
  | {
      type: "run_finished";
      kitId: string;
      agentId: string;
      triggerId: string;
      sessionId: string;
      status: AgentRunStatus;
      turns: number;
      toolCalls: number;
      durationMs: number;
      at: number;
    };

export interface AgentLifecycleHooks {
  onEvent?: (event: AgentLifecycleEvent) => void | Promise<void>;
}

export type AgentRunStatus = "completed" | "cancelled" | "timed_out" | "max_turns" | "failed";

export interface AgentRunError {
  code:
    | "AGENT_CANCELLED"
    | "AGENT_TIMEOUT"
    | "AGENT_MAX_TURNS"
    | "AGENT_MODEL_ERROR"
    | "AGENT_TOOL_ERROR"
    | "AGENT_UNDECLARED_TOOL"
    | "AGENT_OUTPUT_ERROR"
    | "AGENT_SOURCE_ERROR";
  message: string;
}

export interface AgentRunResult {
  status: AgentRunStatus;
  sessionId: string;
  kitId: string;
  agentId: string;
  triggerId: string;
  instructionsVersion: string;
  turns: number;
  toolCalls: number;
  outputs: number;
  durationMs: number;
  finalOutput?: string;
  error?: AgentRunError;
}

export interface DefineAgentConfig<TContext extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  kitId: string;
  trigger: AgentTrigger;
  instructions: AgentInstructions;
  tools: readonly AgentToolDefinition<TContext>[];
  turnSource: AgentTurnSource<TContext>;
  model: AgentModelConnector<TContext>;
  output: AgentOutputSink<TContext>;
  maxTurns?: number;
  maxDurationMs?: number;
  hooks?: AgentLifecycleHooks;
}

export interface AgentDefinition<TContext extends Record<string, unknown> = Record<string, unknown>>
  extends Omit<DefineAgentConfig<TContext>, "hooks"> {
  run: (options: {
    sessionId: string;
    context?: TContext;
    signal?: AbortSignal;
  }) => Promise<AgentRunResult>;
}

// --- Protocol types (Router ↔ Kit Lambda) ---

/**
 * The payload sent from the McpRouter to a kit Lambda when invoking a
 * tool or loader. This is the wire format — kit handlers receive this
 * as their event.
 */
export interface KitToolInvocation {
  toolName?: string;
  loaderSlug?: string;
  args?: Record<string, unknown>;
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
}

/**
 * Input for the `kit()` tool — the progressive discovery onion.
 * `kit()` → list, `kit(cmd)` → describe, `kit(cmd, params)` → run.
 */
export interface KitToolInput {
  id?: string;
  cmd?: string;
  params?: Record<string, unknown>;
}
