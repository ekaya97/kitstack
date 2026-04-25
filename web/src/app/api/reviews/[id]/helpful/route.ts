import { NextRequest, NextResponse } from "next/server";
import { requireAuthorized } from "@/lib/authz";
import { toggleHelpful, getHelpfulCount } from "@/services/review.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await toggleHelpful(id, auth.userId);
  const count = await getHelpfulCount(id);

  return NextResponse.json({ helpfulCount: count });
}
