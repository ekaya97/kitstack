import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createProtocolHandler } from "./protocol";
import { localAdapter } from "./adapters/local";
import type { KitDefinition } from "../types";
import type { KitServerAdapter, ProtocolHandler } from "./types";
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
  type DispatchResult,
  type DispatchErrorCode,
} from "./dispatch";

/** Database connection config passed to `@libsql/client`'s `createClient()`. */
interface DbConfig {
  url: string;
  authToken?: string;
}

/** Base options shared by single-kit and monolith modes. */
interface ServeBaseOptions {
  /**
   * Auth adapter for request authentication.
   * Defaults to `none()` — all requests treated as a default user.
   */
  auth?: AuthAdapter;

  /**
   * Transport mode.
   * - `"stdio"` — reads JSON-RPC from stdin, writes to stdout
   * - `"http"` — HTTP server with `POST /` for JSON-RPC
   *
   * @default "stdio"
   */
  transport?: "stdio" | "http";

  /**
   * HTTP port. Only used when `transport` is `"http"`.
   * @default 3001
   */
  port?: number;

  /** Request/response is the default; daemon owns long-lived upgrades. */
  mode?: ServeMode;
  daemon?: DaemonOptions;

  /** Optional registered MCP servers exposed through the same kit() surface. */
  mcpServers?: readonly McpServerRegistration[];
}

/**
 * Single-kit serve options — one kit, one database.
 */
interface ServeSingleOptions extends ServeBaseOptions {
  kit: KitDefinition;
  kits?: undefined;
  db: DbConfig;
  databases?: undefined;
}

/**
 * Monolith serve options — multiple kits, per-kit databases.
 */
interface ServeMonolithOptions extends ServeBaseOptions {
  kit?: undefined;
  kits: KitDefinition[];
  db?: undefined;
  databases: Record<string, DbConfig>;
}

export type ServeOptions = ServeSingleOptions | ServeMonolithOptions;

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
 * @example Multiple kits with HTTP:
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import crm from "./kits/crm/kit.config";
 * import expense from "./kits/expense/kit.config";
 *
 * serve({
 *   kits: [crm, expense],
 *   databases: {
 *     crm: { url: process.env.CRM_DB_URL! },
 *     "expense-tax-prep": { url: process.env.EXPENSE_DB_URL! },
 *   },
 *   transport: "http",
 *   port: 3001,
 * });
 * ```
 */
export async function serve(options: ServeOptions): Promise<void> {
  const { transport = "stdio", port = 3001, mode = "request" } = options;
  if (mode === "daemon" && transport !== "http") {
    throw new Error('serve({ mode: "daemon" }) requires transport: "http"');
  }
  const auth = options.auth ?? none();

  let adapter: KitServerAdapter;

  if (options.kits) {
    // Monolith mode — combine multiple local adapters
    const adapters = new Map<string, KitServerAdapter>();
    for (const kit of options.kits) {
      const dbConf = options.databases[kit.id];
      if (!dbConf) {
        throw new Error(`Missing database config for kit "${kit.id}". Add it to the databases map.`);
      }
      const client = createClient({ url: dbConf.url, authToken: dbConf.authToken });
      const db = drizzle(client);
      adapters.set(kit.id, localAdapter({ kit, db }));
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
      async executeLoader(kitId, viewSlug, userId) {
        const a = adapters.get(kitId);
        if (!a) throw new Error(`Kit "${kitId}" not found.`);
        return a.executeLoader(kitId, viewSlug, userId);
      },
      async getShellHtml(kitId) {
        const a = adapters.get(kitId);
        if (!a) return "";
        return a.getShellHtml(kitId);
      },
    };
  } else {
    // Single kit mode
    const client = createClient({ url: options.db.url, authToken: options.db.authToken });
    const db = drizzle(client);
    adapter = localAdapter({ kit: options.kit, db });
  }

  adapter = withMcpServers(adapter, options.mcpServers ?? []);
  const protocol = createProtocolHandler({ adapter });

  if (transport === "stdio") {
    await runStdioTransport(protocol);
  } else {
    await runHttpTransport(protocol, auth, port, mode, options.daemon);
  }
}

// --- stdio transport ---

async function runStdioTransport(protocol: ProtocolHandler): Promise<void> {
  process.stderr.write("\n  KitStack MCP Server (stdio)\n\n");

  let buffer = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      try {
        const request = JSON.parse(line);
        const response = await protocol.handleRequest(request, "default-user");
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          }) + "\n"
        );
      }
    }
  });

  await new Promise(() => {});
}

// --- HTTP transport ---

async function runHttpTransport(
  protocol: ProtocolHandler,
  auth: AuthAdapter,
  port: number,
  mode: ServeMode,
  daemon: DaemonOptions | undefined,
): Promise<void> {
  const { createServer } = await import("node:http");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // OAuth metadata
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      const metadata = auth.metadata();
      if (metadata) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(metadata));
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }

    // MCP endpoint (POST /)
    if (req.method === "POST" && url.pathname === "/") {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      let userId = "default-user";
      if (token) {
        const validated = await auth.validate(token);
        if (!validated) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_token" }));
          return;
        }
        userId = validated.userId ?? "default-user";
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();

      try {
        const request = JSON.parse(body);
        const response = await protocol.handleRequest(request, userId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(response ? JSON.stringify(response) : "");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on("upgrade", (request, socket, head) => {
    if (mode !== "daemon" || !daemon?.onUpgrade) {
      socket.destroy();
      return;
    }
    void Promise.resolve(daemon.onUpgrade({ request, socket, head }))
      .then((owned) => { if (!owned) socket.destroy(); })
      .catch(() => socket.destroy());
  });

  server.listen(port, () => {
    process.stderr.write(`\n  KitStack MCP Server (${mode})\n  http://localhost:${port}\n\n`);
  });

  await new Promise(() => {});
}
