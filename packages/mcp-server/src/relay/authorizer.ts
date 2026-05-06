/**
 * WebSocket $connect authorizer for the DevRelay.
 *
 * Validates the CLI session token against BetterAuth's session table
 * in Turso. On success, returns an IAM policy allowing the connection
 * and passes userId/sessionId in the authorizer context.
 *
 * Query params: ?sessionId={id}&token={token}
 */

import type { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, gt } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { tursoDbUrl, tursoAuthToken } from "../config";

const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  const params = event.queryStringParameters ?? {};
  const sessionId = params.sessionId;
  const token = params.token;

  if (!sessionId || !token) {
    throw new Error("Unauthorized");
  }

  const client = createClient({
    url: tursoDbUrl(),
    authToken: tursoAuthToken(),
  });
  const db = drizzle(client);

  try {
    const sessions = await db
      .select({ userId: sessionTable.userId })
      .from(sessionTable)
      .where(
        and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, new Date()))
      )
      .limit(1);

    if (sessions.length === 0) {
      throw new Error("Unauthorized");
    }

    return {
      principalId: sessions[0].userId,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: event.methodArn,
          },
        ],
      },
      context: {
        userId: sessions[0].userId,
        sessionId,
      },
    };
  } catch (err: any) {
    if (err.message === "Unauthorized") throw err;
    throw new Error("Unauthorized");
  } finally {
    client.close();
  }
};
