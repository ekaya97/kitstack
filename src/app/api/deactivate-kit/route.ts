import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-session";
import { deactivateKit } from "@/services/kit-lifecycle.service";

export async function POST(request: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kitSlug } = (await request.json()) as { kitSlug?: string };
  if (!kitSlug) {
    return NextResponse.json({ error: "kitSlug is required" }, { status: 400 });
  }

  const result = await deactivateKit(session.user.id, kitSlug);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json(result.data);
}
