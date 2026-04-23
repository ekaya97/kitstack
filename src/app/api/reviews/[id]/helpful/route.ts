import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { toggleHelpful, getHelpfulCount } from "@/services/review.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await toggleHelpful(id, session.user.id);
  const count = await getHelpfulCount(id);

  return NextResponse.json({ helpfulCount: count });
}
