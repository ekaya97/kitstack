import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getReviewsByTarget,
  getRatingDistribution,
  createReview,
} from "@/services/review.service";
import { trackReviewSubmitted } from "@/lib/analytics-server";

export async function GET(request: NextRequest) {
  const targetType = request.nextUrl.searchParams.get("targetType");
  const targetSlug = request.nextUrl.searchParams.get("targetSlug");

  if (!targetType || !targetSlug) {
    return NextResponse.json(
      { error: "targetType and targetSlug required" },
      { status: 400 }
    );
  }

  const [reviewsList, distribution] = await Promise.all([
    getReviewsByTarget(targetType, targetSlug),
    getRatingDistribution(targetType, targetSlug),
  ]);

  return NextResponse.json({ reviews: reviewsList, distribution });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { targetType, targetSlug, rating, text } = body;

  if (!targetType || !targetSlug || !rating || !text) {
    return NextResponse.json(
      { error: "targetType, targetSlug, rating, and text are required" },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  try {
    await createReview({
      targetType,
      targetSlug,
      userId: session.user.id,
      userName: session.user.name || "Anonymous",
      userRole: body.userRole,
      rating,
      text,
    });

    trackReviewSubmitted(session.user.id, targetType, targetSlug, rating);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not save review. Please try again." },
      { status: 500 }
    );
  }
}
