/**
 * WebSocket $connect handler for the DevRelay.
 *
 * Authenticates the CLI session token against BetterAuth's session table
 * in Turso, then stores the WebSocket connection in OAuthStore for
 * message routing.
 *
 * Query params: ?sessionId={id}&token={token}
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, gt } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { tursoDbUrl, tursoAuthToken } from "../config";
import { putOAuthItem } from "../router/oauth-store";

// Inline session table reference (avoid importing from web/)
const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const params = (event as any).queryStringParameters ?? {};
  const sessionId = params.sessionId;
  const token = params.token;

  if (!sessionId || !token) {
    return { statusCode: 400, body: "Missing sessionId or token" };
  }

  // Validate token against BetterAuth session table in Turso
  const client = createClient({ url: tursoDbUrl(), authToken: tursoAuthToken() });
  const db = drizzle(client);

  const sessions = await db
    .select({ userId: sessionTable.userId })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.token, token),
        gt(sessionTable.expiresAt, new Date())
      )
    )
    .limit(1);

  client.close();

  if (sessions.length === 0) {
    return { statusCode: 401, body: "Invalid or expired token" };
  }

  const userId = sessions[0].userId;
  const connectionId = event.requestContext.connectionId!;

  // Store session in DynamoDB for message routing
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  await putOAuthItem({
    pk: `DEV_SESSION#${sessionId}`,
    sk: "CONNECTION",
    connectionId,
    userId,
    ttl,
  } as any);

  return { statusCode: 200, body: "Connected" };
};
