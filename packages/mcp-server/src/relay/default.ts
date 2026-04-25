/**
 * WebSocket $default handler for the DevRelay.
 *
 * Receives responses from the CLI dev server and stores them in
 * DevRelayStore for the McpRouter relay route to pick up.
 *
 * Message format: { requestId: string, result: unknown }
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { putRelayResponse } from "./store";

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

  await putRelayResponse(requestId, JSON.stringify(result));

  return { statusCode: 200, body: "OK" };
};
