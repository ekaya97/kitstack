import { NextRequest, NextResponse } from "next/server";
import { requireAuthorized } from "@/lib/authz";
import { getSessionOrNull } from "@/lib/auth-session";
import {
  addToWishlist,
  removeFromWishlist,
  isWishlisted,
  getUserWishlist,
} from "@/services/wishlist.service";
import {
  trackWishlistItemAdded,
  trackWishlistItemRemoved,
} from "@/lib/analytics-server";

export async function GET(request: NextRequest) {
  // GET is optional-auth: returns empty data for anonymous users
  const session = await getSessionOrNull();
  if (!session?.user) {
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
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const { targetType, targetSlug } = await request.json();
  if (!targetType || !targetSlug) {
    return NextResponse.json(
      { error: "targetType and targetSlug required" },
      { status: 400 }
    );
  }

  await addToWishlist(auth.userId, targetType, targetSlug);
  trackWishlistItemAdded(auth.userId, targetType, targetSlug);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const { targetType, targetSlug } = await request.json();
  if (!targetType || !targetSlug) {
    return NextResponse.json(
      { error: "targetType and targetSlug required" },
      { status: 400 }
    );
  }

  await removeFromWishlist(auth.userId, targetType, targetSlug);
  trackWishlistItemRemoved(auth.userId, targetType, targetSlug);
  return NextResponse.json({ ok: true });
}
