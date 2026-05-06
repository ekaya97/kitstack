/**
 * Kit Lifecycle Service
 *
 * Orchestrates kit activation/deactivation across all storage layers:
 * 1. SQLite (kit_activations) — UI projection, fast reads
 * 2. DynamoDB (UserKitDbs) — MCP source of truth
 * 3. Turso — per-user kit database provisioning
 *
 * DynamoDB is authoritative. If SQLite diverges, MCP behavior is correct.
 */

import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { kitActivations } from "@/db/schema";
import { getSubscription } from "./subscription.service";
import { PLAN_LIMITS, getActiveKitCount, deleteKitActivation } from "./kit-activation.service";
import {
  provisionKit,
  deactivateKitDb,
  deleteKitDb,
} from "./mcp-sync.service";
import {
  trackKitActivated,
  trackKitActivationFailed,
  trackKitDeactivated,
  trackKitDeactivationFailed,
  trackKitDeleted,
} from "@/lib/analytics-server";
import { log } from "@/lib/logger";
import { grantRelation, revokeRelation } from "@kitstackco/authz/lifecycle";

// Kit migrations
import { migrationSql as meetingMigrations } from "@kitstackco/mcp-server/kits/meeting/migrations";
import { migrationSql as crmMigrations } from "@kitstackco/mcp-server/kits/crm/migrations";
import { migrationSql as expenseMigrations } from "@kitstackco/mcp-server/kits/expense/migrations";
import { migrationSql as outreachMigrations } from "@kitstackco/mcp-server/kits/outreach/migrations";

const SLUG_TO_KIT_ID: Record<string, string> = {
  "crm-kit": "crm",
  "expense-tax-prep-kit": "expense-tax-prep",
  "cold-outreach-kit": "cold-outreach",
  "meeting-action-tracker-kit": "meeting-action-tracker",
};

const KIT_MIGRATIONS: Record<string, string> = {
  crm: crmMigrations,
  "expense-tax-prep": expenseMigrations,
  "cold-outreach": outreachMigrations,
  "meeting-action-tracker": meetingMigrations,
};

const VALID_KIT_SLUGS = Object.keys(SLUG_TO_KIT_ID);

export interface LifecycleResult {
  ok: boolean;
  status?: number;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Activate a kit for a user.
 *
 * Order of operations:
 * 1. Validate subscription + plan limits (SQLite)
 * 2. Provision Turso DB if needed (Turso API → DynamoDB)
 * 3. Write DynamoDB UserKitDbs — source of truth
 * 4. Write SQLite kit_activations — UI projection
 */
export async function activateKit(
  userId: string,
  kitSlug: string
): Promise<LifecycleResult> {
  // Validate kit slug
  if (!VALID_KIT_SLUGS.includes(kitSlug)) {
    trackKitActivationFailed(userId, kitSlug, "Unknown kit", "unknown_kit");
    return { ok: false, status: 404, error: `Unknown kit: ${kitSlug}` };
  }

  const kitId = SLUG_TO_KIT_ID[kitSlug];

  // Step 1: Check subscription
  const subscription = await getSubscription(userId);
  if (!subscription) {
    trackKitActivationFailed(userId, kitSlug, "No subscription", "no_subscription");
    return { ok: false, status: 403, error: "Active subscription required." };
  }

  // Check if already active in SQLite
  const existing = await db
    .select()
    .from(kitActivations)
    .where(
      and(
        eq(kitActivations.userId, userId),
        eq(kitActivations.kitSlug, kitSlug)
      )
    )
    .then((r) => r[0]);

  if (existing?.status === "active") {
    return { ok: true, data: { status: "already_active", kitSlug } };
  }

  // Check plan limits
  const limit = PLAN_LIMITS[subscription.plan as keyof typeof PLAN_LIMITS] ?? 0;
  const activeCount = await getActiveKitCount(userId);
  if (activeCount >= limit) {
    trackKitActivationFailed(userId, kitSlug, "Plan limit reached", "plan_limit");
    return {
      ok: false,
      status: 403,
      error: `Your ${subscription.plan} plan allows ${limit} active kit${limit !== 1 ? "s" : ""}. You have ${activeCount} active. Deactivate one first.`,
      data: { activeCount, limit },
    };
  }

  // Step 2+3: Provision Turso DB + write DynamoDB (source of truth)
  const migrationSql = KIT_MIGRATIONS[kitId];
  if (!migrationSql) {
    return { ok: false, status: 500, error: `No migrations for kit: ${kitId}` };
  }

  try {
    await provisionKit(userId, kitId, migrationSql);
  } catch (err: any) {
    log.error("Kit provisioning failed", { userId, kitSlug, error: err.message });
    trackKitActivationFailed(userId, kitSlug, err.message, "provision_failed");
    return { ok: false, status: 500, error: "Failed to provision kit database. Please try again." };
  }

  // Step 4: Write SQLite (UI projection)
  try {
    if (existing) {
      // Reactivate
      await db
        .update(kitActivations)
        .set({ status: "active", deactivatedAt: null })
        .where(
          and(
            eq(kitActivations.userId, userId),
            eq(kitActivations.kitSlug, kitSlug)
          )
        );
    } else {
      // New activation
      await db.insert(kitActivations).values({
        id: nanoid(),
        userId,
        kitSlug,
        status: "active",
      });
    }
  } catch (err: any) {
    // Non-critical — DynamoDB is authoritative, UI will catch up
    log.warn("Kit SQLite write failed (non-critical)", { userId, kitSlug, error: err.message });
  }

  await grantRelation(db, userId, "activator", "kit", kitSlug);

  trackKitActivated(userId, kitSlug, !!existing);

  return { ok: true, data: { status: "activated", kitSlug } };
}

/**
 * Deactivate a kit for a user.
 *
 * Order of operations:
 * 1. Update DynamoDB UserKitDbs status — source of truth
 * 2. Update SQLite kit_activations — UI projection
 */
export async function deactivateKit(
  userId: string,
  kitSlug: string
): Promise<LifecycleResult> {
  const kitId = SLUG_TO_KIT_ID[kitSlug];
  if (!kitId) {
    return { ok: false, status: 404, error: `Unknown kit: ${kitSlug}` };
  }

  // Step 1: DynamoDB (source of truth)
  try {
    await deactivateKitDb(userId, kitId);
  } catch (err: any) {
    log.error("Kit DynamoDB deactivation failed", { userId, kitSlug, error: err.message });
    trackKitDeactivationFailed(userId, kitSlug, err.message);
    return { ok: false, status: 500, error: "Failed to deactivate kit. Please try again." };
  }

  // Step 2: SQLite (UI projection)
  try {
    await db
      .update(kitActivations)
      .set({
        status: "deactivated",
        deactivatedAt: new Date(),
      })
      .where(
        and(
          eq(kitActivations.userId, userId),
          eq(kitActivations.kitSlug, kitSlug),
          eq(kitActivations.status, "active")
        )
      );
  } catch (err: any) {
    log.warn("Kit SQLite deactivation failed (non-critical)", { userId, kitSlug, error: err.message });
  }

  await revokeRelation(db, userId, "activator", "kit", kitSlug);

  trackKitDeactivated(userId, kitSlug);

  return { ok: true, data: { status: "deactivated", kitSlug } };
}

/**
 * Permanently delete a kit for a user.
 * Only allowed for deactivated kits.
 *
 * Order of operations:
 * 1. Verify kit is deactivated (safety check)
 * 2. Destroy Turso database + delete DynamoDB record
 * 3. Delete SQLite kit_activations row
 */
export async function deleteKit(
  userId: string,
  kitSlug: string
): Promise<LifecycleResult> {
  const kitId = SLUG_TO_KIT_ID[kitSlug];
  if (!kitId) {
    return { ok: false, status: 404, error: `Unknown kit: ${kitSlug}` };
  }

  // Step 1: Verify it's deactivated in SQLite
  const existing = await db
    .select()
    .from(kitActivations)
    .where(
      and(
        eq(kitActivations.userId, userId),
        eq(kitActivations.kitSlug, kitSlug)
      )
    )
    .then((r) => r[0]);

  if (!existing) {
    return { ok: false, status: 404, error: "Kit not found." };
  }

  if (existing.status === "active") {
    return { ok: false, status: 400, error: "Deactivate the kit before deleting." };
  }

  // Step 2: Destroy Turso DB + delete DynamoDB record
  try {
    await deleteKitDb(userId, kitId);
  } catch (err: any) {
    log.error("Kit deletion failed", { userId, kitSlug, error: err.message });
    return { ok: false, status: 500, error: "Failed to delete kit data. Please try again." };
  }

  // Step 3: Delete SQLite row
  try {
    await deleteKitActivation(userId, kitSlug);
  } catch (err: any) {
    log.warn("Kit SQLite deletion failed (non-critical)", { userId, kitSlug, error: err.message });
  }

  await revokeRelation(db, userId, "activator", "kit", kitSlug);

  trackKitDeleted(userId, kitSlug);

  return { ok: true, data: { status: "deleted", kitSlug } };
}
