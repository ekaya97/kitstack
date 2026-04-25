import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createMcpHandler } from "../runtime/mcp-handler";
import type { KitDefinition } from "../types";
import type { AuthAdapter } from "./auth/adapter";
import { none } from "./auth/none";

export type { AuthAdapter, OAuthServerMetadata } from "./auth";
export { none, kitstack, oauth } from "./auth";
export type { KitStackAuthConfig, OAuthConfig } from "./auth";

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
   * Use `kitstack()` for KitStack identity provider or `oauth()` for custom auth.
   */
  auth?: AuthAdapter;

  /**
   * Transport mode.
   * - `"stdio"` — reads JSON-RPC from stdin, writes to stdout (for Claude Desktop/Code)
   * - `"http"` — HTTP server with `POST /` for JSON-RPC and OAuth metadata endpoint
   *
   * @default "stdio"
   */
  transport?: "stdio" | "http";

  /**
   * HTTP port. Only used when `transport` is `"http"`.
   * @default 3000
   */
  port?: number;
}

/**
 * Single-kit serve options — one kit, one database.
 *
 * @example
 * ```typescript
 * serve({ kit, db: { url: "file:dev.db" } });
 * ```
 */
interface ServeSingleOptions extends ServeBaseOptions {
  kit: KitDefinition;
  kits?: undefined;
  db: DbConfig;
  databases?: undefined;
}

/**
 * Monolith serve options — multiple kits, per-kit databases.
 *
 * Each kit gets its own database connection. Tools are namespaced
 * by kit ID to avoid collisions.
 *
 * @example
 * ```typescript
 * serve({
 *   kits: [crmKit, outreachKit],
 *   databases: {
 *     crm: { url: process.env.CRM_DB! },
 *     "cold-outreach": { url: process.env.OUTREACH_DB! },
 *   },
 *   transport: "http",
 *   port: 3000,
 * });
 * ```
 */
interface ServeMonolithOptions extends ServeBaseOptions {
  kit?: undefined;
  kits: KitDefinition[];
  db?: undefined;
  databases: Record<string, DbConfig>;
}

/**
 * Configuration for {@link serve}.
 *
 * Supports two modes:
 * - **Single kit:** `{ kit, db }` — one kit, one database
 * - **Monolith:** `{ kits, databases }` — multiple kits, per-kit databases
 */
export type ServeOptions = ServeSingleOptions | ServeMonolithOptions;

/**
 * Start a self-hosted MCP server for a kit.
 *
 * Wires together the MCP protocol handler, an auth adapter, and a database
 * connection into a complete server. Supports stdio transport (for local dev
 * with Claude Desktop/Code) and HTTP transport (for production deployments).
 *
 * The server registers all kit tools plus a `kit_view` tool (if the kit
 * has views), handles the MCP `initialize` handshake with `io.modelcontextprotocol/ui`
 * capabilities, and processes `tools/call` requests by dispatching to tool handlers.
 *
 * @param options - Server configuration (kit, auth, db, transport)
 *
 * @example Local development with stdio (what `kitstack dev --stdio` runs internally):
 * ```typescript
 * import { serve, none } from "@kitstack/sdk/server";
 * import kit from "./kit.config";
 *
 * serve({
 *   kit,
 *   auth: none(),
 *   db: { url: "file:.kitstack/dev.db" },
 *   transport: "stdio",
 * });
 * ```
 *
 * @example Self-hosted HTTP server with Turso:
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import kit from "./kit.config";
 *
 * serve({
 *   kit,
 *   db: {
 *     url: process.env.DATABASE_URL!,
 *     authToken: process.env.DATABASE_TOKEN,
 *   },
 *   transport: "http",
 *   port: 3000,
 * });
 * ```
 *
 * @example Monolith mode — multiple kits in a single server:
 * ```typescript
 * import { serve, kitstack } from "@kitstack/sdk/server";
 * import crmKit from "../kits/crm/kit.config";
 * import outreachKit from "../kits/outreach/kit.config";
 *
 * serve({
 *   kits: [crmKit, outreachKit],
 *   databases: {
 *     crm: { url: process.env.CRM_DB! },
 *     "cold-outreach": { url: process.env.OUTREACH_DB! },
 *   },
 *   auth: kitstack({
 *     clientId: process.env.KITSTACK_CLIENT_ID!,
 *     clientSecret: process.env.KITSTACK_CLIENT_SECRET!,
 *   }),
 *   transport: "http",
 *   port: 3000,
 * });
 * ```
 */
export async function serve(options: ServeOptions): Promise<void> {
  const { transport = "stdio", port = 3000 } = options;
  const auth = options.auth ?? none();

  let handler: ReturnType<typeof createMcpHandler>;
  let displayKit: KitDefinition;

  if (options.kits) {
    // Monolith mode — merge kits into a single handler
    // Each kit gets its own DB. Tools are served under the combined kit.
    const kits = options.kits;
    const allTools = [];
    const allViews = [];

    for (const k of kits) {
      const dbConf = options.databases[k.id];
      if (!dbConf) {
        throw new Error(
          `Missing database config for kit "${k.id}". Add it to the databases map.`
        );
      }
      // Prefix tool names with kit ID to avoid collisions
      for (const t of k.tools) {
        allTools.push({ ...t, name: `${k.id}/${t.name}` });
      }
      for (const v of k.views ?? []) {
        allViews.push({ ...v, slug: `${k.id}/${v.slug}` });
      }
    }

    // Use the first kit's DB as the default handler DB (tools route internally)
    const firstKit = kits[0];
    const firstDbConf = options.databases[firstKit.id];
    const client = createClient({
      url: firstDbConf.url,
      authToken: firstDbConf.authToken,
    });
    const db = drizzle(client);

    displayKit = {
      id: "monolith",
      version: "1.0.0",
      name: `KitStack (${kits.length} kits)`,
      description: kits.map((k) => k.name).join(", "),
      schema: {},
      migrationSql: "",
      instructions: kits.map((k) => k.instructions).join("\n\n"),
      tools: allTools as any,
      views: allViews.length > 0 ? (allViews as any) : undefined,
    };

    handler = createMcpHandler({ kit: displayKit, db });
  } else {
    // Single kit mode
    const client = createClient({
      url: options.db.url,
      authToken: options.db.authToken,
    });
    const db = drizzle(client);
    displayKit = options.kit;
    handler = createMcpHandler({ kit: displayKit, db });
  }

  if (transport === "stdio") {
    await startStdio(handler, displayKit);
  } else {
    await startHttp(handler, auth, displayKit, port);
  }
}

// ---------------------------------------------------------------------------
// stdio transport — reads JSON-RPC from stdin, writes to stdout
// ---------------------------------------------------------------------------

async function startStdio(
  handler: ReturnType<typeof createMcpHandler>,
  kit: KitDefinition
): Promise<void> {
  process.stderr.write(
    `\n  KitStack MCP Server (stdio)\n  Kit: ${kit.name} (${kit.tools.length} tools, ${kit.views?.length ?? 0} views)\n\n`
  );

  let buffer = "";

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;

    // Process complete JSON-RPC messages (newline-delimited)
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const request = JSON.parse(line);
        const response = await handler.handleRequest(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch {
        // Malformed JSON — send parse error
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

  // Keep process alive
  await new Promise(() => {});
}

// ---------------------------------------------------------------------------
// HTTP transport — basic HTTP server for MCP over streamable HTTP
// ---------------------------------------------------------------------------

async function startHttp(
  handler: ReturnType<typeof createMcpHandler>,
  auth: AuthAdapter,
  kit: KitDefinition,
  port: number
): Promise<void> {
  const { createServer } = await import("node:http");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // OAuth metadata endpoint
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
      // Validate auth
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (token) {
        const validated = await auth.validate(token);
        if (!validated) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_token" }));
          return;
        }
      }

      // Read request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();

      try {
        const request = JSON.parse(body);
        const response = await handler.handleRequest(request);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(response ? JSON.stringify(response) : "");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          })
        );
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    process.stderr.write(
      `\n  KitStack MCP Server (HTTP)\n  Kit: ${kit.name} (${kit.tools.length} tools, ${kit.views?.length ?? 0} views)\n  http://localhost:${port}\n\n`
    );
  });

  // Keep process alive
  await new Promise(() => {});
}
