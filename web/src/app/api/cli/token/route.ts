import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { session as sessionTable } from "@/db/auth-schema";
import { nanoid } from "nanoid";
import { eq, and, asc } from "drizzle-orm";

const MAX_CLI_SESSIONS = 5;

/**
 * Validate that a callback URL is a safe localhost URL.
 * Returns null if valid, or an error string if invalid.
 */
export function validateCallbackUrl(callback: string): string | null {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callback);
  } catch {
    return "Invalid callback URL";
  }

  if (callbackUrl.protocol !== "http:") {
    return "Callback must use http:";
  }

  const allowedHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (!allowedHosts.includes(callbackUrl.hostname)) {
    return "Callback must be localhost";
  }

  if (callbackUrl.username || callbackUrl.password) {
    return "Callback must not contain credentials";
  }

  const port = parseInt(callbackUrl.port || "80", 10);
  if (port < 1024 || port > 65535) {
    return "Callback port must be 1024-65535";
  }

  return null;
}

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

  const validationError = validateCallbackUrl(callback);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Enforce CLI session cap — delete oldest if at limit
  const existingCliSessions = await db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.userId, userSession.user.id),
        eq(sessionTable.userAgent, "kitstack-cli")
      )
    )
    .orderBy(asc(sessionTable.createdAt));

  if (existingCliSessions.length >= MAX_CLI_SESSIONS) {
    const toDelete = existingCliSessions.slice(0, existingCliSessions.length - MAX_CLI_SESSIONS + 1);
    for (const s of toDelete) {
      await db.delete(sessionTable).where(eq(sessionTable.id, s.id));
    }
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
