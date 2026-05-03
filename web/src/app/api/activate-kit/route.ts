export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuthorized } from "@/lib/authz";
import { activateKit } from "@/services/kit-lifecycle.service";
import { flushLogs } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const { kitSlug } = (await request.json()) as { kitSlug?: string };
  if (!kitSlug) {
    return NextResponse.json({ error: "kitSlug is required" }, { status: 400 });
  }

  after(() => flushLogs());

  const result = await activateKit(auth.userId, kitSlug);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...result.data },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json(result.data);
}
