import type { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { StorageAdapter } from "./storage";

// --- Context ---

/** The storage handle supplied by the host for a request. */
export type StorageBinding = LibSQLDatabase;

/** The authenticated subject and the actor making a request on its behalf. */
export interface RequestIdentity {
  principal: string;
  actor: string;
  /** Optional delegation chain or host-issued delegation identifier. */
  delegation?: string | Readonly<Record<string, unknown>>;
}

/** Channel metadata preserved across a request's capability calls. */
export interface ChannelContext {
  kind: string;
  id?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

/** Channels are transport declarations; a turn carries their metadata. */
export type ChannelKind =
  | "mcp"
  | "http"
  | "webhook"
  | "schedule"
  | "stream"
  | "voice"
  | "proxy"
  | "internal";

export interface ChannelDefinition {
  readonly id: string;
  readonly kind: ChannelKind;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Request/session correlation fields used by telemetry and audit sinks. */
export interface SessionContext {
  id: string;
  traceId: string;
  parentId?: string;
}

export type TelemetryAttributes = Readonly<Record<string, string | number | boolean | null>>;

/** Minimal telemetry seam; hosts may adapt this to OpenTelemetry or another backend. */
export interface TelemetrySink {
  event(name: string, attributes?: TelemetryAttributes): void | Promise<void>;
  metric(name: string, value: number, attributes?: TelemetryAttributes): void | Promise<void>;
}

/** Audit seam for durable, policy-relevant actions. */
export interface AuditSink {
  record(event: {
    action: string;
    outcome?: "success" | "failure" | "denied";
    attributes?: Readonly<Record<string, unknown>>;
  }): void | Promise<void>;
}

/** Host logging seam that keeps capability code independent of a logger package. */
export interface Logger {
  debug(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  info(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  warn(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  error(message: string, attributes?: Readonly<Record<string, unknown>>): void;
}

/** Placeholder registry seam for request-scoped external connectors. */
export interface ConnectorRegistry {
  get<T = unknown>(id: string): T | undefined;
  require<T = unknown>(id: string): T;
  has(id: string): boolean;
}

/**
 * Runtime context passed to every tool handler and loader invocation.
 *
 * Hosts construct one instance per request. Instructions and memory are
 * composed capabilities, not implicit context fields.
 *
 * @example
 * ```typescript
 * handler: async (ctx, args) => {
 *   const rows = await ctx.db.select().from(contacts);
 *   ctx.telemetry.event("contacts.loaded", { count: rows.length });
 *   return kit.json(rows);
 * }
 * ```
 */
export interface KitContext {
  /**
   * Legacy Drizzle/libSQL binding. Prefer `storage` for new kit code; this
   * field remains until the maintained kits complete their hard migration.
   */
  db: StorageBinding;
  /** Provider-neutral, host-bound storage capability. */
  storage?: StorageAdapter;
  /** Request parameters supplied by the host for a view or capability call. */
  params: Readonly<Record<string, unknown>>;
  connectors: ConnectorRegistry;
  identity: RequestIdentity;
  channel: ChannelContext;
  session: SessionContext;
  telemetry: TelemetrySink;
  audit: AuditSink;
  log: Logger;
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
  load: (ctx: KitContext, args: any) => Promise<any>;
  handler?: (ctx: KitContext, args: any) => Promise<KitToolResult>;
}

/** Tool with handler() only (no data layer) */
interface ToolHandlerOnly extends ToolBase {
  load?: undefined;
  handler: (ctx: KitContext, args: any) => Promise<KitToolResult>;
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
 *   handler: async (ctx, args) => {
 *     const data = await loadContacts(ctx, args);
 *     return kit.text(formatTable(data));
 *   },
 * });
 *
 * // Write tool with handler only
 * const addContact = defineTool({
 *   name: "add_contact",
 *   description: "Add a new contact to the CRM",
 *   args: z.object({ name: z.string() }),
 *   handler: async (ctx, args) => {
 *     await ctx.db.insert(contacts).values({ id: nanoid(), name: args.name });
 *     return kit.text(`Contact "${args.name}" added.`);
 *   },
 * });
 * ```
 */
export type ToolDefinition = ToolWithLoad | ToolHandlerOnly;

// --- Loader ---

/**
 * A server-side data function for a view. Receives the request context and
 * returns typed data that becomes the view component's props.
 *
 * Create loaders with {@link defineLoader}.
 */
export type LoaderFn = (ctx: KitContext) => Promise<unknown>;

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

/** The two supported surfaces for a KitStack View. */
export type ViewHostKind = "chat" | "shell";

/** The current size of the host surface in CSS pixels. */
export interface ViewHostSize {
  width: number;
  height: number;
}

/** Theme information supplied by the host. */
export interface ViewHostTheme {
  mode: "light" | "dark";
}

/**
 * Capabilities supplied by the host to a View renderer.
 *
 * A View must be able to render in an MCP Apps chat iframe and in the
 * KitStack dashboard shell without maintaining two implementations. The
 * host owns navigation, identity, sizing, and theme; kits only consume this
 * typed boundary.
 */
export interface ViewHost {
  kind: ViewHostKind;
  size: ViewHostSize;
  navigate: (viewId: string, params?: Readonly<Record<string, unknown>>) => void | Promise<void>;
  identity: RequestIdentity;
  theme: ViewHostTheme;
}

/** Props passed to a View component by the SDK-generated host adapter. */
export interface ViewComponentProps<TData> {
  data: TData;
  host: ViewHost;
}

/** Public renderer signature frozen by the View host contract. */
export type ViewRender<TData> = (data: TData, host: ViewHost) => React.ReactNode;

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
  /** Stable public identifier. `slug` remains the router/build alias. */
  id: string;
  slug: string;
  name: string;
  description: string;
  /** The loader set declared by the public View API. The first loader is the primary data loader. */
  loaders: readonly [TLoader];
  loader: TLoader;
  render: ViewRender<Awaited<ReturnType<TLoader>>>;
  component: React.ComponentType<ViewComponentProps<Awaited<ReturnType<TLoader>>>>;
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
  jobs?: JobDefinition<any>[];
  views?: ViewDefinition<any>[];
  /**
   * View placeholder data extracted from view definitions by
   * {@link defineKit}. Keyed by view slug. Used by the DevKit server
   * only — not included in production builds.
   * @internal
   */
  _placeholders?: Record<string, unknown>;
}

// --- Jobs ---

/** A typed scheduled job declared by a kit. */
export interface JobDefinition<TArgs extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schedule: string;
  timeoutSeconds: number;
  args?: TArgs;
  handler: (ctx: KitContext, args: z.infer<TArgs>) => Promise<KitToolResult | void>;
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
  /** Trace correlation shared by every turn in this run. */
  traceId: string;
  /** Optional parent span/session supplied by the host. */
  parentId?: string;
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

/** Metadata returned by a model/provider connector; bodies are never accepted here. */
export interface AgentTurnMetadata {
  provider?: string | null;
  model?: string | null;
  requestTokens?: number | null;
  responseTokens?: number | null;
  /** Estimated provider cost for this model turn, in USD. */
  costUsd?: number | null;
  latencyMs?: number | null;
  routingReason?: string | null;
  cancellationReason?: string | null;
  timeoutReason?: string | null;
}

/** A model response: either emit a message or request one declared tool. */
export type AgentModelResponse =
  | { type: "message"; content: string; terminal?: boolean; metadata?: AgentTurnMetadata }
  | { type: "tool_call"; toolCallId?: string; name: string; args: unknown; metadata?: AgentTurnMetadata };

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
  /** Static provider identity used when a response does not repeat it. */
  provider?: string;
  /** Static model identity used when a response does not repeat it. */
  model?: string;
  /** Optional reason for declarative/model routing decisions. */
  routingReason?: string;
  /** Estimate cost from provider usage when the response omits it. */
  estimateCostUsd?: (usage: { requestTokens?: number | null; responseTokens?: number | null }) => number | null;
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
      traceId: string;
      parentId?: string;
      instructionsVersion: string;
      at: number;
    }
  | {
      type: "turn_started";
      kitId: string;
      agentId: string;
      sessionId: string;
      traceId: string;
      parentId?: string;
      turn: number;
      at: number;
    }
  | {
      type: "turn_finished";
      kitId: string;
      agentId: string;
      sessionId: string;
      traceId: string;
      parentId?: string;
      turn: number;
      outcome: "message" | "tool_call" | "error";
      durationMs: number;
      provider?: string | null;
      model?: string | null;
      requestTokens?: number | null;
      responseTokens?: number | null;
      costUsd?: number | null;
      routingReason?: string | null;
      cancellationReason?: string | null;
      timeoutReason?: string | null;
      at: number;
    }
  | {
      type: "tool_called";
      kitId: string;
      agentId: string;
      sessionId: string;
      traceId: string;
      parentId?: string;
      turn: number;
      toolName: string;
      outcome: "completed" | "failed" | "rejected";
      durationMs: number;
      provider?: string | null;
      model?: string | null;
      requestTokens?: number | null;
      responseTokens?: number | null;
      costUsd?: number | null;
      routingReason?: string | null;
      cancellationReason?: string | null;
      timeoutReason?: string | null;
      at: number;
    }
  | {
      type: "run_finished";
      kitId: string;
      agentId: string;
      triggerId: string;
      sessionId: string;
      traceId: string;
      parentId?: string;
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
    traceId?: string;
    parentId?: string;
    context?: TContext;
    signal?: AbortSignal;
  }) => Promise<AgentRunResult>;
}

// --- Protocol types (Router ↔ Kit Lambda) ---

/**
 * The payload sent from the McpRouter to a kit Lambda when invoking a
 * tool, loader, or job. This is the wire format — kit handlers receive this
 * as their event.
 */
export interface KitToolInvocation {
  toolName?: string;
  loaderSlug?: string;
  jobName?: string;
  args?: Record<string, unknown>;
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
  params?: Record<string, unknown>;
  sessionId?: string;
  traceId?: string;
  parentId?: string;
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
