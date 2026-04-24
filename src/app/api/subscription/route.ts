import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-session";
import {
  getSubscription,
  createSubscription,
  cancelSubscription,
} from "@/services/subscription.service";
import {
  trackSubscriptionCreated,
  trackSubscriptionCancelled,
} from "@/lib/analytics-server";

// GET /api/subscription — get current user's subscription
export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await getSubscription(session.user.id);
  return NextResponse.json({ subscription });
}

// POST /api/subscription — subscribe to a plan (mocked billing)
export async function POST(request: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const plan = body.plan as "starter" | "pro";

  if (!["starter", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const subscription = await createSubscription(session.user.id, plan);
  trackSubscriptionCreated(session.user.id, plan);
  return NextResponse.json({ subscription });
}

// DELETE /api/subscription — cancel subscription
export async function DELETE() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscription(session.user.id);
  await cancelSubscription(session.user.id);
  trackSubscriptionCancelled(session.user.id, sub?.plan ?? "unknown");
  return NextResponse.json({ cancelled: true });
}
