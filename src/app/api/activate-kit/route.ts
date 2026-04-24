import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSessionOrNull } from "@/lib/auth-session";
import { activateKit } from "@/services/kit-lifecycle.service";
import { flushLogs } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kitSlug } = (await request.json()) as { kitSlug?: string };
  if (!kitSlug) {
    return NextResponse.json({ error: "kitSlug is required" }, { status: 400 });
  }

  after(() => flushLogs());

  const result = await activateKit(session.user.id, kitSlug);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...result.data },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json(result.data);
}
