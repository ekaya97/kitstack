import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createMcpHandler } from "../runtime/mcp-handler";
import type { KitDefinition } from "../types";
import type { AuthAdapter } from "./auth/adapter";
import { none } from "./auth/none";

export type { AuthAdapter, OAuthServerMetadata } from "./auth";
export { none } from "./auth";

export interface ServeOptions {
  /** Single kit definition. */
  kit: KitDefinition;
  /** Auth adapter. Defaults to none() (no auth, dev mode). */
  auth?: AuthAdapter;
  /** Database connection config. */
  db: { url: string; authToken?: string };
  /** Transport mode. Default: "stdio". */
  transport?: "stdio" | "http";
  /** HTTP port (only used with transport: "http"). Default: 3000. */
  port?: number;
}

/**
 * Start a self-hosted MCP server for a kit.
 *
 * ```ts
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
 */
export async function serve(options: ServeOptions): Promise<void> {
  const { kit, db: dbConfig, transport = "stdio", port = 3000 } = options;
  const auth = options.auth ?? none();

  // Connect to database
  const client = createClient({
    url: dbConfig.url,
    authToken: dbConfig.authToken,
  });
  const db = drizzle(client);

  // Create MCP handler
  const handler = createMcpHandler({ kit, db });

  if (transport === "stdio") {
    await startStdio(handler, kit);
  } else {
    await startHttp(handler, auth, kit, port);
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
