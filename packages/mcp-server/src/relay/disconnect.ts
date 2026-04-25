/**
 * WebSocket $disconnect handler for the DevRelay.
 *
 * Best-effort cleanup. TTL (5 minutes) on DevRelayStore handles
 * stale session removal automatically.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async () => {
  return { statusCode: 200, body: "Disconnected" };
};
