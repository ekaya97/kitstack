import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { verifyAppToken } from "../framework/app-token";
import { getUserKitDb } from "../framework/dynamo";
import { createKitDbClient } from "../framework/kit-db";
import { audit } from "../framework/audit";
import { log, flushLogs } from "../framework/logger";
import { sql } from "drizzle-orm";

const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || "https://kitstack.co,https://www.kitstack.co")
  .split(",")
  .map((o) => o.trim());

function getAllowedOrigin(requestOrigin: string | undefined): string {
  if (!requestOrigin) return ALLOWED_ORIGINS[0];
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
}

function json(body: unknown, status = 200, origin?: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getAllowedOrigin(origin),
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    },
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;
  const origin = event.headers.origin;

  if (method === "OPTIONS") return json({}, 204, origin);

  if (method !== "GET") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const token = event.queryStringParameters?.token;
    if (!token) return json({ error: "Missing token" }, 401, origin);

    // Verify JWT
    let payload: { sub: string; kit: string };
    try {
      payload = await verifyAppToken(token);
    } catch {
      return json({ error: "Invalid or expired token" }, 401, origin);
    }

    // Look up the user's kit database
    const userDb = await getUserKitDb(payload.sub, payload.kit);
    if (!userDb) {
      return json({ error: "Kit not activated" }, 404, origin);
    }

    // Connect to the user's kit database
    const db = createKitDbClient(userDb.dbUrl, userDb.dbToken);

    // Route based on view parameter
    const view = event.queryStringParameters?.view;
    if (!view) return json({ error: "Missing view parameter" }, 400, origin);

    // Generic table query — the view param maps to a table name
    // In the future, each kit would register its own app-data views
    // For now, support basic table reads
    const safeTableNames = [
      "meetings",
      "action_items",
      "decisions",
      "contacts",
      "deals",
      "activities",
      "proposals",
      "expenses",
      "quarterly_summaries",
      "sequences",
      "emails",
      "prospects",
    ];

    if (!safeTableNames.includes(view)) {
      return json({ error: `Unknown view: ${view}` }, 400, origin);
    }

    const parsedLimit = parseInt(event.queryStringParameters?.limit || "100", 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return json({ error: "Invalid limit: must be an integer between 1 and 1000" }, 400, origin);
    }
    // view is validated against safeTableNames above; limit is validated as a safe integer
    const result = await db.all(sql`SELECT * FROM ${sql.raw(view)} ORDER BY created_at DESC LIMIT ${parsedLimit}`);

    audit({ action: "appdata.query", userId: payload.sub, kitId: payload.kit, detail: view });

    return json({
      kit: payload.kit,
      view,
      data: result.rows,
      count: result.rows.length,
    }, 200, origin);
  } catch (err: any) {
    log.error("App Data error", { error: err.message });
    return json({ error: "Internal server error" }, 500, origin);
  } finally {
    await flushLogs();
  }
}
