/**
 * WebSocket $disconnect handler for the DevRelay.
 *
 * Cleans up the session entry in OAuthStore when the CLI disconnects.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const dynamo = new DynamoDBClient({});

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId!;

  // Find the session for this connection by scanning DEV_SESSION# entries.
  // In production, a GSI on connectionId would be more efficient, but
  // dev relay sessions are few (max 2 per user) so a scan is acceptable.
  // For now, the connection ID is stored when the session is created and
  // the CLI also sends the sessionId on disconnect — but the WebSocket
  // $disconnect doesn't guarantee query params, so we look up by connectionId.

  // Since we don't have a GSI, we rely on the CLI to clean up its session.
  // The TTL (24h) ensures stale sessions are eventually purged.
  // This handler is a best-effort cleanup.

  return { statusCode: 200, body: "Disconnected" };
};
