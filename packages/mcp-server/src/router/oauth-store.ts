import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OAuthStoreItem } from "../framework/types";

const client = new DynamoDBClient({});

function tableName(): string {
  const name = process.env.OAUTH_STORE_TABLE;
  if (!name) throw new Error("OAUTH_STORE_TABLE env var not set");
  return name;
}

export async function getOAuthItem(
  pk: string,
  sk: string
): Promise<OAuthStoreItem | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: tableName(),
      Key: marshall({ pk, sk }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as OAuthStoreItem) : null;
}

export async function putOAuthItem(item: OAuthStoreItem): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: tableName(),
      Item: marshall(item),
    })
  );
}

export async function deleteOAuthItem(pk: string, sk: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: tableName(),
      Key: marshall({ pk, sk }),
    })
  );
}
