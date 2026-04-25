/**
 * WebSocket $default handler for the DevRelay.
 *
 * Receives responses from the CLI dev server and stores them in OAuthStore
 * for the McpRouter relay route to pick up.
 *
 * Message format: { requestId: string, result: unknown }
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { putOAuthItem } from "../router/oauth-store";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const body = event.body;
  if (!body) {
    return { statusCode: 400, body: "Empty message" };
  }

  let message: { requestId?: string; result?: unknown };
  try {
    message = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { requestId, result } = message;
  if (!requestId) {
    return { statusCode: 400, body: "Missing requestId" };
  }

  // Store the response for the McpRouter relay route to poll
  const ttl = Math.floor(Date.now() / 1000) + 60; // 60 second TTL
  await putOAuthItem({
    pk: `DEV_REQ#${requestId}`,
    sk: "RESPONSE",
    body: JSON.stringify(result),
    ttl,
  } as any);

  return { statusCode: 200, body: "OK" };
};
