import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { session as sessionTable } from "@/db/auth-schema";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  let userSession;
  try {
    userSession = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callback } = await request.json();
  if (!callback || typeof callback !== "string") {
    return NextResponse.json({ error: "Missing callback" }, { status: 400 });
  }

  // Validate callback is localhost
  try {
    const url = new URL(callback);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Callback must be localhost" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  // Create a long-lived BetterAuth session for the CLI
  const token = nanoid(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  await db.insert(sessionTable).values({
    id: nanoid(),
    token,
    userId: userSession.user.id,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    userAgent: "kitstack-cli",
    ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
  });

  return NextResponse.json({ token });
}
