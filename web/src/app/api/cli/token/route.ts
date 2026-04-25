import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { nanoid } from "nanoid";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const dynamo = new DynamoDBClient({});

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callback } = await request.json();
  if (!callback || typeof callback !== "string") {
    return NextResponse.json({ error: "Missing callback" }, { status: 400 });
  }

  // Validate callback is localhost (security: don't redirect tokens to arbitrary URLs)
  try {
    const url = new URL(callback);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Callback must be localhost" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  // Generate token
  const token = `kst_${nanoid(32)}`;

  // Store in OAuthStore so the relay can validate it
  const ttl = Math.floor(Date.now() / 1000) + 365 * 86400; // 1 year
  await dynamo.send(
    new PutItemCommand({
      TableName: (Resource as any).OAuthStore.name,
      Item: marshall({
        pk: `CLI_TOKEN#${token}`,
        sk: "META",
        userId: session.user.id,
        email: session.user.email,
        ttl,
      }),
    })
  );

  return NextResponse.json({ token });
}
