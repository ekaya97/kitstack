import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createProtocolHandler } from "./protocol";
import { localAdapter, type LocalAdapterOptions } from "./adapters/local";
import type { KitDefinition, KitToolResult } from "../types";
import type { KitServerAdapter, ProtocolHandler, ServerRequestContext } from "./types";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { withMcpServers, type McpServerRegistration } from "./manifest";
import type { AuthAdapter } from "./auth/adapter";
import { none } from "./auth/none";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

export type { AuthAdapter, OAuthServerMetadata } from "./auth";
export { none, kitstack, oauth } from "./auth";
export type { KitStackAuthConfig, OAuthConfig } from "./auth";

export type ServeMode = "request" | "daemon";

/** Runtime-owned upgrade boundary for long-lived channels such as voice. */
export interface DaemonUpgrade {
  readonly request: IncomingMessage;
  readonly socket: Duplex;
  readonly head: Buffer;
}

export interface DaemonOptions {
  /** Return true after the callback has taken ownership of the socket. */
  readonly onUpgrade?: (upgrade: DaemonUpgrade) => boolean | Promise<boolean>;
}

// Re-export shared server components
export { createProtocolHandler } from "./protocol";
export { localAdapter } from "./adapters/local";
export type {
  KitServerAdapter,
  ResolvedKit,
  ResolvedTool,
  ResolvedView,
  McpToolDefinition,
  ProtocolHandler,
  ServerRequestContext,
} from "./types";
export {
  parseMcpServerManifest,
  resolveMcpPassthrough,
  McpManifestError,
  type McpServerManifest,
  type McpServerToolManifest,
  type McpPassthroughCall,
  type McpServerCallContext,
  type McpServerRegistration,
  withMcpServers,
} from "./manifest";
export {
  dispatch,
  createDispatchEnvelope,
  type DispatchEnvelope,
  type DispatchRequestContext,
  type DispatchDependencies,
  type DispatchAuditEvent,
  type DispatchAuditSink,
  type DispatchResult,
  type DispatchErrorCode,
} from "./dispatch";

/** Database connection config passed to `@libsql/client`'s `createClient()`. */
interface DbConfig {
  url: string;
  authToken?: string;
}

/** A connection config, or an existing Drizzle database owned by the caller. */
export type ServeDatabase = DbConfig | LibSQLDatabase;

/** A non-MCP HTTP request, already parsed for route handlers. */
export interface HttpRouteRequest {
  method: string;
  /** Path without the query string. */
  path: string;
  query: Record<string, string | undefined>;
  /** Header names are lower-case. */
  headers: Record<string, string | undefined>;
  /** Parsed JSON or form body; undefined for GET/HEAD or an empty body. */
  body?: Record<string, unknown>;
  /** The original request, for handlers that need raw access. */
  raw: IncomingMessage;
}

export interface HttpRouteResponse {
  status: number;
  headers?: Record<string, string>;
  /** Strings are sent as-is; anything else is sent as JSON. */
  body?: unknown;
}

/** A kit-owned HTTP route such as a provider webhook or a status endpoint. */
export interface HttpRoute {
  /** HTTP method; omit to match any method. */
  method?: string;
  /** Exact path, or a pattern tested against the path. */
  path: string | RegExp;
  handler(request: HttpRouteRequest): Promise<HttpRouteResponse> | HttpRouteResponse;
}

/** Result of authenticating an MCP request. */
export type RequestAuthentication =
  | { userId: string }
  | { status: 401 | 403; body?: unknown; headers?: Record<string, string> };

export interface ServeCorsOptions {
  origin?: string;
  headers?: readonly string[];
  methods?: readonly string[];
}

/** Base options shared by single-kit and monolith modes. */
interface ServeBaseOptions {
  /**
   * Auth adapter for request authentication.
   * Defaults to `none()` — all requests treated as a default user.
   */
  auth?: AuthAdapter;

  /**
   * Custom MCP authentication. When set, it replaces the bearer-token check
   * of `auth` for the MCP endpoint (for example, service-to-service tokens).
   */
  authenticate?: (request: HttpRouteRequest) => Promise<RequestAuthentication>;

  /**
   * Transport mode.
   * - `"stdio"` — reads JSON-RPC from stdin, writes to stdout
   * - `"http"` — HTTP server with the MCP endpoint at `mcpPath`
   *
   * @default "stdio"
   */
  transport?: "stdio" | "http";

  /**
   * HTTP port. Only used when `transport` is `"http"`. Use 0 for an ephemeral port.
   * @default 3001
   */
  port?: number;

  /** HTTP host to bind. @default "127.0.0.1" — containers should use "0.0.0.0". */
  host?: string;

  /** Path of the MCP JSON-RPC endpoint. @default "/" */
  mcpPath?: string;

  /** Kit-owned HTTP routes served next to MCP (webhooks, status, APIs). */
  routes?: readonly HttpRoute[];

  /** Add CORS headers and answer preflight requests. Off by default. */
  cors?: ServeCorsOptions;

  /** Request body limit in bytes. @default 1 MiB */
  maxBodyBytes?: number;

  /** Request/response is the default; daemon owns long-lived upgrades. */
  mode?: ServeMode;
  daemon?: DaemonOptions;

  /** Optional registered MCP servers exposed through the same kit() surface. */
  mcpServers?: readonly McpServerRegistration[];

  /**
   * Checks the requirements returned by tool `authorize` hooks. Without it,
   * those tools are denied: self-hosted servers fail closed.
   */
  checkAuthz?: LocalAdapterOptions["checkAuthz"];

  /** "skip" runs `authorize`-guarded tools unchecked. Local development only. */
  authorization?: LocalAdapterOptions["authorization"];

  /** HTML shell used to render Views (for example `.kitstack/build/shell.html`). */
  shellHtml?: string;

  /** Runs on `close()` before the HTTP server stops, e.g. to end live calls. */
  onShutdown?: () => Promise<void> | void;

  /** Streams for the stdio transport. Defaults to process.stdin/stdout. */
  stdio?: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream };
}

/**
 * Single-kit serve options — one kit, one database.
 */
interface ServeSingleOptions extends ServeBaseOptions {
  kit: KitDefinition;
  kits?: undefined;
  db: ServeDatabase;
  databases?: undefined;
}

/**
 * Monolith serve options — multiple kits, per-kit databases.
 */
interface ServeMonolithOptions extends ServeBaseOptions {
  kit?: undefined;
  kits: KitDefinition[];
  db?: undefined;
  databases: Record<string, ServeDatabase>;
}

export type ServeOptions = ServeSingleOptions | ServeMonolithOptions;

/** A running server. */
export interface ServeHandle {
  /** Bound port (HTTP transport); 0 for stdio. */
  readonly port: number;
  readonly host: string;
  /** Run `onShutdown`, then stop accepting connections. */
  close(): Promise<void>;
  /** stdio only: resolves once the input has ended and every request was answered. */
  readonly finished?: Promise<void>;
}

/**
 * A server plugin such as a voice or messaging channel: its routes, upgrade
 * handler and shutdown hook are mounted next to the kit's own.
 */
export interface ServerPlugin {
  readonly routes?: readonly HttpRoute[];
  /** Return true after taking ownership of the upgraded socket. */
  onUpgrade?(upgrade: DaemonUpgrade): boolean | Promise<boolean>;
  /** Runs on close() before the HTTP server stops, e.g. to end live calls. */
  onShutdown?(): void | Promise<void>;
}

/** The composed kit runtime, before any transport is started. */
export interface KitServer {
  readonly adapter: KitServerAdapter;
  readonly protocol: ProtocolHandler;
  /**
   * Mount a plugin before listen(). Plugins can call the kit's tools through
   * this server (e.g. kitAgentTools({ executor: server })), so they are
   * created after the server and mounted here.
   */
  use(plugin: ServerPlugin): KitServer;
  /** Run a kit tool through the same dispatch path as MCP (validation, authz, telemetry). */
  executeTool(kitId: string, toolName: string, args: Record<string, unknown>, principal: string): Promise<KitToolResult>;
  /** Start the configured transport. */
  listen(): Promise<ServeHandle>;
}

/**
 * Compose kits into a server without starting a transport. Use this when
 * other parts of the host (for example a voice channel) must call kit tools
 * through the same dispatch path as MCP.
 */
export function createKitServer(options: ServeOptions): KitServer {
  const transport = options.transport ?? "stdio";
  const adapterOptions = {
    checkAuthz: options.checkAuthz,
    authorization: options.authorization,
    shellHtml: options.shellHtml,
  };

  let adapter: KitServerAdapter;

  if (options.kits) {
    // Monolith mode — combine multiple local adapters
    const adapters = new Map<string, KitServerAdapter>();
    for (const kit of options.kits) {
      const dbConf = options.databases[kit.id];
      if (!dbConf) {
        throw new Error(`Missing database config for kit "${kit.id}". Add it to the databases map.`);
      }
      adapters.set(kit.id, localAdapter({ kit, db: resolveDatabase(dbConf), ...adapterOptions }));
    }

    // Composite adapter that delegates to per-kit adapters
    adapter = {
      async resolveUserKits(userId) {
        const results = await Promise.all(
          [...adapters.values()].map((a) => a.resolveUserKits(userId))
        );
        return results.flat();
      },
      async executeTool(kitId, toolName, args, userId) {
        const a = adapters.get(kitId);
        if (!a) return { content: [{ type: "text", text: `Kit "${kitId}" not found.` }], isError: true };
        return a.executeTool(kitId, toolName, args, userId);
      },
      async executeLoader(kitId, viewSlug, userId, context, params) {
        const a = adapters.get(kitId);
        if (!a) throw new Error(`Kit "${kitId}" not found.`);
        return a.executeLoader(kitId, viewSlug, userId, context, params);
      },
      async getShellHtml(kitId) {
        const a = adapters.get(kitId);
        if (!a) return "";
        return a.getShellHtml(kitId);
      },
    };
  } else {
    adapter = localAdapter({ kit: options.kit, db: resolveDatabase(options.db), ...adapterOptions });
  }

  adapter = withMcpServers(adapter, options.mcpServers ?? []);
  const serverInfo = options.kit
    ? { name: options.kit.name, version: options.kit.version ?? "0.0.0" }
    : undefined;
  const protocol = createProtocolHandler({ adapter, ...(serverInfo ? { serverInfo } : {}) });

  const plugins: ServerPlugin[] = [];
  let listening = false;
  const server: KitServer = {
    adapter,
    protocol,
    use(plugin) {
      if (listening) throw new Error("Mount plugins before listen()");
      plugins.push(plugin);
      return server;
    },
    executeTool: (kitId, toolName, args, principal) => adapter.executeTool(kitId, toolName, args, principal),
    listen: () => {
      listening = true;
      const composed = withPlugins(options, plugins);
      return transport === "stdio" ? runStdioTransport(protocol, composed) : runHttpTransport(protocol, composed);
    },
  };
  return server;
}

/**
 * Start a self-hosted MCP server for one or more kits.
 *
 * @example Single kit with stdio:
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import kit from "./kit.config";
 *
 * serve({
 *   kit,
 *   db: { url: "file:.kitstack/dev.db" },
 * });
 * ```
 *
 * @example HTTP with a provider webhook next to MCP:
 * ```typescript
 * const server = await serve({
 *   kit,
 *   db: { url: process.env.DB_URL! },
 *   transport: "http",
 *   mcpPath: "/mcp",
 *   routes: [{ method: "POST", path: "/webhooks/provider", handler: handleWebhook }],
 * });
 * process.once("SIGTERM", () => void server.close());
 * ```
 */
export async function serve(options: ServeOptions): Promise<ServeHandle> {
  return createKitServer(options).listen();
}

/** Plugin routes come first so a kit's catch-all route cannot shadow them. */
function withPlugins(options: ServeOptions, plugins: readonly ServerPlugin[]): ServeOptions {
  if (plugins.length === 0) return options;
  const upgradeHandlers = [
    ...plugins.flatMap((plugin) => plugin.onUpgrade ? [plugin.onUpgrade.bind(plugin)] : []),
    ...(options.daemon?.onUpgrade ? [options.daemon.onUpgrade] : []),
  ];
  return {
    ...options,
    // Plugins that take over upgrades (e.g. media streams) need daemon mode.
    mode: upgradeHandlers.length ? "daemon" : options.mode,
    routes: [...plugins.flatMap((plugin) => plugin.routes ?? []), ...(options.routes ?? [])],
    daemon: {
      ...options.daemon,
      onUpgrade: async (upgrade) => {
        for (const handler of upgradeHandlers) if (await handler(upgrade)) return true;
        return false;
      },
    },
    onShutdown: async () => {
      for (const plugin of plugins) await plugin.onShutdown?.();
      await options.onShutdown?.();
    },
  };
}

function resolveDatabase(db: ServeDatabase): LibSQLDatabase {
  if (isDbConfig(db)) {
    const client = createClient({ url: db.url, authToken: db.authToken });
    return drizzle(client);
  }
  return db;
}

function isDbConfig(db: ServeDatabase): db is DbConfig {
  return typeof (db as DbConfig).url === "string";
}

// --- stdio transport ---

async function runStdioTransport(protocol: ProtocolHandler, options: ServeOptions): Promise<ServeHandle> {
  const input = options.stdio?.input ?? process.stdin;
  const output = options.stdio?.output ?? process.stdout;
  if (!options.stdio) process.stderr.write("\n  KitStack MCP Server (stdio)\n\n");

  // Requests are answered in order; stdout carries protocol messages only.
  let queue = Promise.resolve();
  let buffer = "";
  const handleLine = async (line: string) => {
    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
      return;
    }
    const response = await protocol.handleRequest(request as any, "default-user");
    if (response) output.write(JSON.stringify(response) + "\n");
  };
  const onData = (chunk: string | Buffer) => {
    buffer += chunk.toString();
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) queue = queue.then(() => handleLine(line));
    }
  };
  const finished = new Promise<void>((resolve) => {
    input.once("end", () => {
      const rest = buffer.trim();
      buffer = "";
      if (rest) queue = queue.then(() => handleLine(rest));
      void queue.then(resolve);
    });
  });
  if ("setEncoding" in input && typeof input.setEncoding === "function") input.setEncoding("utf-8");
  input.on("data", onData);

  let closed = false;
  return {
    port: 0,
    host: "stdio",
    finished,
    async close() {
      if (closed) return;
      closed = true;
      input.off("data", onData);
      await options.onShutdown?.();
    },
  };
}

// --- HTTP transport ---

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const CORRELATION_HEADERS = ["x-request-id", "x-session-id", "x-trace-id", "x-parent-id", "traceparent"] as const;

class BodyTooLargeError extends Error {}

async function runHttpTransport(protocol: ProtocolHandler, options: ServeOptions): Promise<ServeHandle> {
  const { createServer } = await import("node:http");
  const auth = options.auth ?? none();
  const mode = options.mode ?? "request";
  const mcpPath = options.mcpPath ?? "/";
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const routes = options.routes ?? [];
  const corsHeaders = options.cors ? buildCorsHeaders(options.cors) : undefined;

  const send = (res: import("node:http").ServerResponse, response: HttpRouteResponse) => {
    const headers: Record<string, string> = { ...(corsHeaders ?? {}), ...(response.headers ?? {}) };
    const isText = typeof response.body === "string";
    if (response.body !== undefined && !Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
      headers["content-type"] = isText ? "text/plain; charset=utf-8" : "application/json";
    }
    res.writeHead(response.status, headers);
    res.end(response.body === undefined ? undefined : isText ? response.body as string : JSON.stringify(response.body));
  };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://kitstack.local");
      const method = (req.method ?? "GET").toUpperCase();

      if (method === "OPTIONS" && corsHeaders) {
        send(res, { status: 204 });
        return;
      }
      if (method === "GET" && url.pathname === "/healthz") {
        send(res, { status: 200, body: { status: "ok" } });
        return;
      }

      // OAuth metadata
      if (url.pathname === "/.well-known/oauth-authorization-server") {
        const metadata = auth.metadata();
        send(res, metadata ? { status: 200, body: metadata } : { status: 404 });
        return;
      }

      const request: HttpRouteRequest = {
        method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: lowerCaseHeaders(req.headers),
        body: await readBody(req, maxBodyBytes),
        raw: req,
      };

      // MCP endpoint
      if (method === "POST" && url.pathname === mcpPath) {
        let userId = "default-user";
        if (options.authenticate) {
          const result = await options.authenticate(request);
          if ("status" in result) {
            send(res, { status: result.status, headers: result.headers, body: result.body ?? { error: "unauthorized" } });
            return;
          }
          userId = result.userId;
        } else {
          const authHeader = request.headers.authorization;
          const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
          if (token) {
            const validated = await auth.validate(token);
            if (!validated) {
              send(res, { status: 401, body: { error: "invalid_token" } });
              return;
            }
            userId = validated.userId ?? "default-user";
          }
        }

        if (!request.body) {
          send(res, { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } } });
          return;
        }
        const response = await protocol.handleRequest(request.body as any, userId, requestContext(request.headers));
        send(res, response ? { status: 200, body: response } : { status: 202 });
        return;
      }

      const route = routes.find((candidate) =>
        (!candidate.method || candidate.method.toUpperCase() === method)
        && (typeof candidate.path === "string" ? candidate.path === url.pathname : candidate.path.test(url.pathname)));
      if (route) {
        send(res, await route.handler(request));
        return;
      }

      send(res, { status: 404, body: { error: "not_found" } });
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        send(res, { status: 413, body: { error: "body_too_large" } });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      send(res, { status: 400, body: { error: "invalid_request", message } });
    }
  });

  server.on("upgrade", (request, socket, head) => {
    if (mode !== "daemon" || !options.daemon?.onUpgrade) {
      socket.destroy();
      return;
    }
    void Promise.resolve(options.daemon.onUpgrade({ request, socket, head }))
      .then((owned) => { if (!owned) socket.destroy(); })
      .catch(() => socket.destroy());
  });

  const host = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 3001, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 3001;
  process.stderr.write(`\n  KitStack MCP Server (${mode})\n  http://${host}:${port}${mcpPath}\n\n`);

  let closed = false;
  return {
    port,
    host,
    async close() {
      if (closed) return;
      closed = true;
      // Let long-lived channels end first: server.close() waits for every
      // open connection, so an active call would otherwise block shutdown.
      await options.onShutdown?.();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function buildCorsHeaders(cors: ServeCorsOptions): Record<string, string> {
  return {
    "access-control-allow-origin": cors.origin ?? "*",
    "access-control-allow-headers": (cors.headers ?? ["authorization", "content-type", ...CORRELATION_HEADERS]).join(", "),
    "access-control-allow-methods": (cors.methods ?? ["GET", "POST", "OPTIONS"]).join(","),
  };
}

function lowerCaseHeaders(headers: IncomingMessage["headers"]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) result[name.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  return result;
}

function requestContext(headers: Record<string, string | undefined>): ServerRequestContext | undefined {
  const context: ServerRequestContext = {
    requestId: headers["x-request-id"],
    sessionId: headers["x-session-id"],
    traceId: headers["x-trace-id"],
    parentId: headers["x-parent-id"],
    traceparent: headers.traceparent,
  };
  return Object.values(context).some(Boolean) ? context : undefined;
}

async function readBody(req: IncomingMessage, maxBodyBytes: number): Promise<Record<string, unknown> | undefined> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBodyBytes) throw new BodyTooLargeError("request body exceeds limit");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) throw new BodyTooLargeError("request body exceeds limit");
    chunks.push(buffer);
  }
  if (total === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  const parsed: unknown = contentType.includes("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(raw).entries())
    : JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be a JSON object");
  return parsed as Record<string, unknown>;
}
