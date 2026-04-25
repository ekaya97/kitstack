/**
 * Proxied database client for sandboxed third-party kits.
 *
 * Routes all SQL queries through the McpRouter Lambda instead of connecting
 * to Turso directly. The kit code is unchanged — `db.insert(...)` and
 * `db.select(...)` work identically. The proxy is invisible to kit authors.
 *
 * Security model: the kit Lambda never sees database credentials. Instead,
 * it receives an `invocationToken` (valid for 60s) that the McpRouter
 * validates before executing the query against the real database.
 *
 * @module
 */

import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

/**
 * Result shape returned by the McpRouter's DB proxy handler.
 */
interface ProxyResult {
  columns?: string[];
  rows?: unknown[][];
  rowsAffected?: number;
  lastInsertRowid?: bigint | number;
  error?: string;
}

/**
 * Create a Drizzle-compatible database client that routes queries through
 * the McpRouter Lambda. Used by the generic third-party handler for sandboxed kits.
 *
 * The returned client implements the libSQL client interface (`execute` and `batch`)
 * so it can be passed directly to `drizzle()`. All queries are serialized as JSON,
 * sent to the router via `lambda.invoke()`, and the results are deserialized back.
 *
 * @param routerArn - The ARN of the McpRouter Lambda function
 * @param invocationToken - Short-lived token (60s TTL) that authorizes DB access
 * @returns A Drizzle `LibSQLDatabase` instance backed by the proxy
 *
 * @example
 * ```typescript
 * // infra/runtime/third-party-handler.ts
 * import { createProxiedDbClient } from "@kitstack/sdk/runtime/proxied-db";
 * import kit from "./kit.mjs";
 *
 * export async function main(event) {
 *   const db = createProxiedDbClient(event.routerArn, event.invocationToken);
 *   const ctx = { userId: event.userId, kitId: event.kitId };
 *
 *   const tool = kit.tools.find(t => t.name === event.toolName);
 *   const parsed = tool.args.parse(event.args);
 *   return tool.handler(db, parsed, ctx);
 * }
 * ```
 */
export function createProxiedDbClient(
  routerArn: string,
  invocationToken: string
): LibSQLDatabase {
  // Lazy-load the AWS SDK to avoid bundling it in non-sandboxed environments
  let lambdaClient: any;

  async function getLambdaClient() {
    if (!lambdaClient) {
      const { LambdaClient } = await import("@aws-sdk/client-lambda");
      lambdaClient = new LambdaClient({});
    }
    return lambdaClient;
  }

  async function invokeProxy(payload: Record<string, unknown>): Promise<any> {
    const { InvokeCommand } = await import("@aws-sdk/client-lambda");
    const client = await getLambdaClient();

    const response = await client.send(
      new InvokeCommand({
        FunctionName: routerArn,
        Payload: JSON.stringify({
          __dbProxy: true,
          invocationToken,
          ...payload,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.Payload));

    if (result.error) {
      throw new Error(`DB proxy error: ${result.error}`);
    }

    return result;
  }

  // Build a libSQL-compatible client that Drizzle can use
  const client = {
    async execute(stmt: string | { sql: string; args?: unknown[] }) {
      const normalized =
        typeof stmt === "string" ? { sql: stmt, args: [] } : stmt;

      const result: ProxyResult = await invokeProxy({
        sql: normalized.sql,
        args: normalized.args ?? [],
      });

      return {
        columns: result.columns ?? [],
        rows: result.rows ?? [],
        rowsAffected: result.rowsAffected ?? 0,
        lastInsertRowid: result.lastInsertRowid ?? BigInt(0),
      };
    },

    async batch(
      stmts: Array<string | { sql: string; args?: unknown[] }>
    ) {
      const normalized = stmts.map((s) =>
        typeof s === "string" ? { sql: s, args: [] } : s
      );

      const result = await invokeProxy({ batch: normalized });
      return result.results ?? [];
    },

    close() {
      // No-op — the proxy doesn't hold a persistent connection
    },
  };

  return drizzle(client as any);
}
