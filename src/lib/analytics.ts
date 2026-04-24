/**
 * Client-side analytics — typed PostHog event helpers.
 *
 * Wraps posthog-js .capture() with the event contract.
 * Safe to call server-side (no-ops when window is undefined).
 */

import { posthog } from "./posthog";
import type { AnalyticsEvent, AnalyticsEventMap } from "./analytics-events";

function capture<E extends AnalyticsEvent>(
  event: E,
  properties: AnalyticsEventMap[E]
) {
  if (typeof window === "undefined") return;
  posthog?.capture(event, properties);
}

// ── Subscription ────────────────────────────────────────────────
export function trackSubscriptionCreated(plan: "starter" | "pro") {
  capture("subscription_created", { plan });
}

export function trackSubscriptionCancelled(plan: string) {
  capture("subscription_cancelled", { plan });
}

// ── Kit Lifecycle ───────────────────────────────────────────────
export function trackKitActivated(kitSlug: string) {
  capture("kit_activated", { kit_slug: kitSlug, is_reactivation: false });
}

export function trackKitDeactivated(kitSlug: string) {
  capture("kit_deactivated", { kit_slug: kitSlug });
}

// ── Wishlist ────────────────────────────────────────────────────
export function trackWishlistItemAdded(
  targetType: string,
  targetSlug: string
) {
  capture("wishlist_item_added", { target_type: targetType, target_slug: targetSlug });
}

export function trackWishlistItemRemoved(
  targetType: string,
  targetSlug: string
) {
  capture("wishlist_item_removed", { target_type: targetType, target_slug: targetSlug });
}
