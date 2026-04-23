import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  addToWishlist,
  removeFromWishlist,
  isWishlisted,
  getUserWishlist,
} from "@/services/wishlist.service";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ wishlisted: false, wishlists: [] });
  }

  // Check a specific item
  const targetType = request.nextUrl.searchParams.get("targetType");
  const targetSlug = request.nextUrl.searchParams.get("targetSlug");
  if (targetType && targetSlug) {
    const result = await isWishlisted(session.user.id, targetType, targetSlug);
    return NextResponse.json({ wishlisted: result });
  }

  const items = await getUserWishlist(session.user.id);
  return NextResponse.json({ wishlists: items });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetType, targetSlug } = await request.json();
  if (!targetType || !targetSlug) {
    return NextResponse.json(
      { error: "targetType and targetSlug required" },
      { status: 400 }
    );
  }

  await addToWishlist(session.user.id, targetType, targetSlug);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetType, targetSlug } = await request.json();
  if (!targetType || !targetSlug) {
    return NextResponse.json(
      { error: "targetType and targetSlug required" },
      { status: 400 }
    );
  }

  await removeFromWishlist(session.user.id, targetType, targetSlug);
  return NextResponse.json({ ok: true });
}
