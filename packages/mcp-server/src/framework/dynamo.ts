import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { KitRegistryItem, UserKitDbItem } from "./types";

const client = new DynamoDBClient({});

function tableName(envKey: string): string {
  const name = process.env[envKey];
  if (!name) throw new Error(`${envKey} env var not set`);
  return name;
}

// --- Kit Registry ---

export async function getAllRegistryItems(): Promise<KitRegistryItem[]> {
  const result = await client.send(
    new ScanCommand({ TableName: tableName("KIT_REGISTRY_TABLE") })
  );
  return (result.Items || []).map((item) => unmarshall(item) as KitRegistryItem);
}

export async function getRegistryItemsForKit(kitId: string): Promise<KitRegistryItem[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: tableName("KIT_REGISTRY_TABLE"),
      KeyConditionExpression: "kitId = :kitId",
      ExpressionAttributeValues: marshall({ ":kitId": kitId }),
    })
  );
  return (result.Items || []).map((item) => unmarshall(item) as KitRegistryItem);
}

export async function putRegistryItem(item: KitRegistryItem): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: tableName("KIT_REGISTRY_TABLE"),
      Item: marshall(item),
    })
  );
}

// --- User Kit Databases ---

export async function getUserKitDb(
  userId: string,
  kitId: string
): Promise<UserKitDbItem | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: tableName("USER_KIT_DBS_TABLE"),
      Key: marshall({ userId, kitId }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as UserKitDbItem) : null;
}

export async function putUserKitDb(item: UserKitDbItem): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: tableName("USER_KIT_DBS_TABLE"),
      Item: marshall(item),
    })
  );
}

export async function getUserKitDbs(userId: string): Promise<UserKitDbItem[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: tableName("USER_KIT_DBS_TABLE"),
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: marshall({ ":userId": userId }),
    })
  );
  return (result.Items || [])
    .map((item) => unmarshall(item) as UserKitDbItem)
    .filter((item) => item.kitId !== TOOLS_CHANGED_KIT_ID);
}

// --- Tools Changed Flag ---

const TOOLS_CHANGED_KIT_ID = "__tools_changed";

export async function setToolsChanged(userId: string): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: tableName("USER_KIT_DBS_TABLE"),
      Item: marshall({
        userId,
        kitId: TOOLS_CHANGED_KIT_ID,
        dbUrl: "flag",
        dbToken: "",
        provisionedAt: new Date().toISOString(),
      }),
    })
  );
}

export async function checkAndClearToolsChanged(userId: string): Promise<boolean> {
  const result = await client.send(
    new GetItemCommand({
      TableName: tableName("USER_KIT_DBS_TABLE"),
      Key: marshall({ userId, kitId: TOOLS_CHANGED_KIT_ID }),
    })
  );

  if (!result.Item) return false;

  // Clear the flag
  await client.send(
    new DeleteItemCommand({
      TableName: tableName("USER_KIT_DBS_TABLE"),
      Key: marshall({ userId, kitId: TOOLS_CHANGED_KIT_ID }),
    })
  );

  return true;
}
