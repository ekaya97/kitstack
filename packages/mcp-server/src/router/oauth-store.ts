import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { resource } from "../framework/resource";
import type { OAuthStoreItem } from "../framework/types";

const client = new DynamoDBClient({});

export async function getOAuthItem(
  pk: string,
  sk: string
): Promise<OAuthStoreItem | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: resource("OAuthStore").name,
      Key: marshall({ pk, sk }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as OAuthStoreItem) : null;
}

export async function putOAuthItem(item: OAuthStoreItem): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: resource("OAuthStore").name,
      Item: marshall(item),
    })
  );
}

export async function deleteOAuthItem(pk: string, sk: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: resource("OAuthStore").name,
      Key: marshall({ pk, sk }),
    })
  );
}
