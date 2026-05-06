export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ exists: false });
  }

  try {
    const result = await db.all<{ id: string }>(
      sql`SELECT id FROM user WHERE email = ${email.toLowerCase()} LIMIT 1`
    );
    return NextResponse.json({ exists: result.length > 0 });
  } catch (err: any) {
    // Table may not exist yet (BetterAuth creates it on first auth request)
    log.warn("Check email query failed", { error: err?.message });
    return NextResponse.json({ exists: false });
  }
}
