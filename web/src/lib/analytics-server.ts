/**
 * Server-side analytics — fire-and-forget event capture.
 *
 * Uses posthog-node. Every helper is a thin wrapper that
 * maps to an event in the contract (analytics-events.ts).
 * Safe to call even when PostHog is not configured — it no-ops.
 */

import { getPostHogServer } from "./posthog-server";
import type { AnalyticsEvent, AnalyticsEventMap } from "./analytics-events";

function capture<E extends AnalyticsEvent>(
  userId: string,
  event: E,
  properties: AnalyticsEventMap[E]
) {
  const ph = getPostHogServer();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
}

// ── Subscription ────────────────────────────────────────────────
export function trackSubscriptionCreated(
  userId: string,
  plan: "starter" | "pro"
) {
  capture(userId, "subscription_created", { plan });
}

export function trackSubscriptionCancelled(userId: string, plan: string) {
  capture(userId, "subscription_cancelled", { plan });
}

// ── Kit Lifecycle ───────────────────────────────────────────────
export function trackKitActivated(
  userId: string,
  kitSlug: string,
  isReactivation: boolean
) {
  capture(userId, "kit_activated", {
    kit_slug: kitSlug,
    is_reactivation: isReactivation,
  });
}

export function trackKitActivationFailed(
  userId: string,
  kitSlug: string,
  error: string,
  reason: "no_subscription" | "plan_limit" | "unknown_kit" | "provision_failed"
) {
  capture(userId, "kit_activation_failed", {
    kit_slug: kitSlug,
    error,
    reason,
  });
}

export function trackKitDeactivated(userId: string, kitSlug: string) {
  capture(userId, "kit_deactivated", { kit_slug: kitSlug });
}

export function trackKitDeactivationFailed(
  userId: string,
  kitSlug: string,
  error: string
) {
  capture(userId, "kit_deactivation_failed", {
    kit_slug: kitSlug,
    error,
  });
}

// ── Skills ──────────────────────────────────────────────────────
export function trackSkillDownloaded(
  userId: string | null,
  skillSlug: string
) {
  capture(userId ?? "anonymous", "skill_downloaded", {
    skill_slug: skillSlug,
    authenticated: userId !== null,
  });
}

// ── Reviews ─────────────────────────────────────────────────────
export function trackReviewSubmitted(
  userId: string,
  targetType: string,
  targetSlug: string,
  rating: number
) {
  capture(userId, "review_submitted", {
    target_type: targetType,
    target_slug: targetSlug,
    rating,
  });
}

// ── Kit Deletion ───────────────────────────────────────────────
export function trackKitDeleted(userId: string, kitSlug: string) {
  capture(userId, "kit_deleted", { kit_slug: kitSlug });
}

// ── Auth ───────────────────────────────────────────────────────
export function trackUserSignedUp(
  userId: string,
  provider: "email" | "google" | "github"
) {
  capture(userId, "user_signed_up", { provider });
}

export function trackUserSignedIn(
  userId: string,
  provider: "email" | "google" | "github"
) {
  capture(userId, "user_signed_in", { provider });
}

// ── MCP ────────────────────────────────────────────────────────
export function trackMcpConnectionChecked(
  userId: string,
  connected: boolean
) {
  capture(userId, "mcp_connection_checked", { connected });
}

// ── Wishlist ────────────────────────────────────────────────────
export function trackWishlistItemAdded(
  userId: string,
  targetType: string,
  targetSlug: string
) {
  capture(userId, "wishlist_item_added", {
    target_type: targetType,
    target_slug: targetSlug,
  });
}

export function trackWishlistItemRemoved(
  userId: string,
  targetType: string,
  targetSlug: string
) {
  capture(userId, "wishlist_item_removed", {
    target_type: targetType,
    target_slug: targetSlug,
  });
}
