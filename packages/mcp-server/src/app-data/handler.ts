import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { verifyAppToken } from "../framework/app-token";
import { getUserKitDb } from "../framework/dynamo";
import { createKitDbClient } from "../framework/kit-db";
import { sql } from "drizzle-orm";

function json(body: unknown, status = 200): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") return json({}, 204);

  if (method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const token = event.queryStringParameters?.token;
    if (!token) return json({ error: "Missing token" }, 401);

    // Verify JWT
    let payload: { sub: string; kit: string };
    try {
      payload = await verifyAppToken(token);
    } catch {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // Look up the user's kit database
    const userDb = await getUserKitDb(payload.sub, payload.kit);
    if (!userDb) {
      return json({ error: "Kit not activated" }, 404);
    }

    // Connect to the user's kit database
    const db = createKitDbClient(userDb.dbUrl, userDb.dbToken);

    // Route based on view parameter
    const view = event.queryStringParameters?.view;
    if (!view) return json({ error: "Missing view parameter" }, 400);

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
      return json({ error: `Unknown view: ${view}` }, 400);
    }

    const limit = parseInt(event.queryStringParameters?.limit || "100", 10);
    const result = await db.all(sql.raw(`SELECT * FROM ${view} ORDER BY created_at DESC LIMIT ${limit}`));

    return json({
      kit: payload.kit,
      view,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err: any) {
    console.error("App Data error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
}
