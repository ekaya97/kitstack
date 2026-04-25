import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuthorized } from "@/lib/authz";
import { deactivateKit } from "@/services/kit-lifecycle.service";
import { flushLogs } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const { kitSlug } = (await request.json()) as { kitSlug?: string };
  if (!kitSlug) {
    return NextResponse.json({ error: "kitSlug is required" }, { status: 400 });
  }

  const auth = await requireAuthorized([
    { relation: "activator", objectType: "kit", objectId: kitSlug },
  ]);
  if (!auth.ok) return auth.response;

  after(() => flushLogs());

  const result = await deactivateKit(auth.userId, kitSlug);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json(result.data);
}
