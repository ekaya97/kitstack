/**
 * WebSocket $connect handler for the DevRelay.
 *
 * Auth is handled by the authorizer Lambda — this handler receives
 * the validated userId and sessionId from the authorizer context
 * and stores the WebSocket connection for message routing.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { putOAuthItem } from "../router/oauth-store";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const authorizer = (event.requestContext as any).authorizer;
  const userId = authorizer?.userId;
  const sessionId = authorizer?.sessionId;

  if (!userId || !sessionId) {
    return { statusCode: 500, body: "Missing authorizer context" };
  }

  const connectionId = event.requestContext.connectionId!;
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
