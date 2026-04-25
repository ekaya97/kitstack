/**
 * DynamoDB operations for the DevRelay response mailbox.
 *
 * Stores relay request/response pairs with a 5-minute TTL.
 * Used by $default handler (write) and McpRouter relay route (read).
 */
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { devRelayStoreTable } from "../config";

const client = new DynamoDBClient({});
const TTL_SECONDS = 5 * 60; // 5 minutes

export async function putRelayResponse(requestId: string, body: string): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  await client.send(new PutItemCommand({
    TableName: devRelayStoreTable(),
    Item: marshall({ pk: `REQ#${requestId}`, sk: "RESPONSE", body, ttl }),
  }));
}

export async function getRelayResponse(requestId: string): Promise<string | null> {
  const result = await client.send(new GetItemCommand({
    TableName: devRelayStoreTable(),
    Key: marshall({ pk: `REQ#${requestId}`, sk: "RESPONSE" }),
    ConsistentRead: true,
  }));
  if (!result.Item) return null;
  return (unmarshall(result.Item) as any).body ?? null;
}

export async function deleteRelayResponse(requestId: string): Promise<void> {
  await client.send(new DeleteItemCommand({
    TableName: devRelayStoreTable(),
    Key: marshall({ pk: `REQ#${requestId}`, sk: "RESPONSE" }),
  }));
}
