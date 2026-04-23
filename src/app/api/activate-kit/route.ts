import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth-session";
import { getSubscription } from "@/services/subscription.service";
import { db } from "@/lib/db";
import { kitActivations } from "@/db/schema";

// Valid kit slugs
const VALID_KIT_SLUGS = [
  "crm-kit",
  "expense-tax-prep-kit",
  "cold-outreach-kit",
  "meeting-action-tracker-kit",
];

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

  if (!VALID_KIT_SLUGS.includes(kitSlug)) {
    return NextResponse.json({ error: `Unknown kit: ${kitSlug}` }, { status: 404 });
  }

  // Check subscription
  const subscription = await getSubscription(session.user.id);
  if (!subscription) {
    return NextResponse.json(
      { error: "Active subscription required. Subscribe at /pricing first." },
      { status: 403 }
    );
  }

  // Check if already activated
  const existingActivation = await db
    .select()
    .from(kitActivations)
    .where(
      and(
        eq(kitActivations.userId, session.user.id),
        eq(kitActivations.kitSlug, kitSlug),
        eq(kitActivations.status, "active")
      )
    )
    .then((r) => r[0]);

  if (existingActivation) {
    return NextResponse.json({ status: "already_active", kitSlug });
  }

  // Record activation
  // DB provisioning happens when the user connects the MCP connector —
  // the MCP router's tool-dispatcher provisions on first tool call
  await db
    .insert(kitActivations)
    .values({
      id: nanoid(),
      userId: session.user.id,
      kitSlug,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [kitActivations.userId, kitActivations.kitSlug],
      set: { status: "active" },
    });

  return NextResponse.json({ status: "activated", kitSlug });
}
