import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { mcpAuthStoreTable } from "../config";
import type { OAuthStoreItem } from "./types";

const client = new DynamoDBClient({});

export async function getOAuthItem(
  pk: string,
  sk: string
): Promise<OAuthStoreItem | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: mcpAuthStoreTable(),
      Key: marshall({ pk, sk }),
      ConsistentRead: true,
    })
  );
  return result.Item ? (unmarshall(result.Item) as OAuthStoreItem) : null;
}

export async function putOAuthItem(item: OAuthStoreItem): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: mcpAuthStoreTable(),
      Item: marshall(item),
    })
  );
}

export async function deleteOAuthItem(pk: string, sk: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: mcpAuthStoreTable(),
      Key: marshall({ pk, sk }),
    })
  );
}
