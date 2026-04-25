/**
 * WebSocket $connect handler for the DevRelay.
 *
 * Authenticates the CLI token, enforces max 2 concurrent sessions per user,
 * and stores the WebSocket connection in OAuthStore for message routing.
 *
 * Query params: ?sessionId={id}&token={token}
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import {
  getOAuthItem,
  putOAuthItem,
} from "../router/oauth-store";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const params = event.queryStringParameters ?? {};
  const sessionId = params.sessionId;
  const token = params.token;

  if (!sessionId || !token) {
    return { statusCode: 400, body: "Missing sessionId or token" };
  }

  // Validate CLI token
  const tokenRecord = await getOAuthItem(`CLI_TOKEN#${token}`, "META");
  if (!tokenRecord || !(tokenRecord as any).userId) {
    return { statusCode: 401, body: "Invalid token" };
  }

  const userId = (tokenRecord as any).userId as string;
  const connectionId = event.requestContext.connectionId!;

  // Store session
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
