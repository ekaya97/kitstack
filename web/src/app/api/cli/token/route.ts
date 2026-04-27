import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { session as sessionTable } from "@/db/auth-schema";
import { nanoid } from "nanoid";
import { eq, and, asc } from "drizzle-orm";

const MAX_CLI_SESSIONS = 5;

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

  // Validate callback is a safe localhost URL
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callback);
  } catch {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  // Must be http (not https, javascript, file, data, etc.)
  if (callbackUrl.protocol !== "http:") {
    return NextResponse.json({ error: "Callback must use http:" }, { status: 400 });
  }

  // Must be localhost (IPv4, IPv6, or hostname)
  const allowedHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (!allowedHosts.includes(callbackUrl.hostname)) {
    return NextResponse.json({ error: "Callback must be localhost" }, { status: 400 });
  }

  // Reject URLs with embedded credentials (http://user:pass@localhost)
  if (callbackUrl.username || callbackUrl.password) {
    return NextResponse.json({ error: "Callback must not contain credentials" }, { status: 400 });
  }

  // Port must be a number in valid range
  const port = parseInt(callbackUrl.port || "80", 10);
  if (port < 1024 || port > 65535) {
    return NextResponse.json({ error: "Callback port must be 1024-65535" }, { status: 400 });
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
