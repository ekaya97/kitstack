import {
  DynamoDBClient,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { eq } from "drizzle-orm";
import { Resource } from "sst";
import type { KitRegistryItem, UserKitDbItem } from "./types";
import { getTursoDb } from "./authz";
import { kitRegistryTable } from "../../../../src/db/schema";

const client = new DynamoDBClient({});

// --- Kit Registry (Turso) ---

export async function getAllRegistryItems(): Promise<KitRegistryItem[]> {
  const db = getTursoDb();
  const rows = await db.select().from(kitRegistryTable);
  return rows as KitRegistryItem[];
}

export async function getRegistryItemsForKit(kitId: string): Promise<KitRegistryItem[]> {
  const db = getTursoDb();
  const rows = await db.select().from(kitRegistryTable).where(eq(kitRegistryTable.kitId, kitId));
  return rows as KitRegistryItem[];
}

export async function putRegistryItem(item: KitRegistryItem): Promise<void> {
  const db = getTursoDb();
  await db
    .insert(kitRegistryTable)
    .values(item)
    .onConflictDoUpdate({
      target: [kitRegistryTable.kitId, kitRegistryTable.toolName],
      set: {
        toolDescription: item.toolDescription,
        inputSchema: item.inputSchema,
        kitName: item.kitName,
        kitDescription: item.kitDescription,
      },
    });
}

// --- User Kit Databases ---

export async function getUserKitDb(
  userId: string,
  kitId: string
): Promise<UserKitDbItem | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: Resource.UserKitDbs.name,
      Key: marshall({ userId, kitId }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as UserKitDbItem) : null;
}

export async function putUserKitDb(item: UserKitDbItem): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: Resource.UserKitDbs.name,
      Item: marshall(item),
    })
  );
}

export async function updateUserKitDbStatus(
  userId: string,
  kitId: string,
  status: "active" | "deactivated"
): Promise<void> {
  await client.send(
    new UpdateItemCommand({
      TableName: Resource.UserKitDbs.name,
      Key: marshall({ userId, kitId }),
      UpdateExpression: "SET #s = :status",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: marshall({ ":status": status }),
    })
  );
}

export async function deleteUserKitDb(
  userId: string,
  kitId: string
): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: Resource.UserKitDbs.name,
      Key: marshall({ userId, kitId }),
    })
  );
}

export async function getUserKitDbs(userId: string): Promise<UserKitDbItem[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: Resource.UserKitDbs.name,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: marshall({ ":userId": userId }),
    })
  );
  return (result.Items || [])
    .map((item) => unmarshall(item) as UserKitDbItem)
    .filter((item) => item.status !== "deactivated");
}
