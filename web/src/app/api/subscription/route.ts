export const dynamic = "force-dynamic";
import { NextRequest, NextResponse, after } from "next/server";
import { requireAuthorized } from "@/lib/authz";
import {
  getSubscription,
  createSubscription,
  cancelSubscription,
} from "@/services/subscription.service";
import {
  trackSubscriptionCreated,
  trackSubscriptionCancelled,
} from "@/lib/analytics-server";
import { flushLogs } from "@/lib/logger";

// GET /api/subscription — get current user's subscription
export async function GET() {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const subscription = await getSubscription(auth.userId);
  return NextResponse.json({ subscription });
}

// POST /api/subscription — subscribe to a plan (mocked billing)
export async function POST(request: NextRequest) {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const plan = body.plan as "starter" | "pro";

  if (!["starter", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  after(() => flushLogs());

  const subscription = await createSubscription(auth.userId, plan);
  trackSubscriptionCreated(auth.userId, plan);
  return NextResponse.json({ subscription });
}

// DELETE /api/subscription — cancel subscription
export async function DELETE() {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  after(() => flushLogs());

  const sub = await getSubscription(auth.userId);
  await cancelSubscription(auth.userId);
  trackSubscriptionCancelled(auth.userId, sub?.plan ?? "unknown");
  return NextResponse.json({ cancelled: true });
}
