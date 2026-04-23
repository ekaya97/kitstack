import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-session";
import { deactivateKit } from "@/services/kit-activation.service";

export async function POST(request: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { kitSlug } = body as { kitSlug?: string };

  if (!kitSlug) {
    return NextResponse.json({ error: "kitSlug is required" }, { status: 400 });
  }

  await deactivateKit(session.user.id, kitSlug);

  return NextResponse.json({ status: "deactivated", kitSlug });
}
