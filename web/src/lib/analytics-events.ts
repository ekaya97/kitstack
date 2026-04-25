/**
 * PostHog Event Contract
 *
 * Naming convention: object_action (noun_verb past tense)
 * All server-side events include $set for user identification.
 * All events are typed — no ad-hoc .capture() calls.
 */

// ── Subscription ────────────────────────────────────────────────
export interface SubscriptionCreatedProps {
  plan: "starter" | "pro";
}

export interface SubscriptionCancelledProps {
  plan: string;
}

// ── Kit Lifecycle ───────────────────────────────────────────────
export interface KitActivatedProps {
  kit_slug: string;
  is_reactivation: boolean;
}

export interface KitActivationFailedProps {
  kit_slug: string;
  error: string;
  reason: "no_subscription" | "plan_limit" | "unknown_kit" | "provision_failed";
}

export interface KitDeactivatedProps {
  kit_slug: string;
}

export interface KitDeactivationFailedProps {
  kit_slug: string;
  error: string;
}

// ── Skills ──────────────────────────────────────────────────────
export interface SkillDownloadedProps {
  skill_slug: string;
  authenticated: boolean;
}

// ── Reviews ─────────────────────────────────────────────────────
export interface ReviewSubmittedProps {
  target_type: string;
  target_slug: string;
  rating: number;
}

// ── Wishlist ────────────────────────────────────────────────────
export interface WishlistItemAddedProps {
  target_type: string;
  target_slug: string;
}

export interface WishlistItemRemovedProps {
  target_type: string;
  target_slug: string;
}

// ── Event Map ───────────────────────────────────────────────────
export interface AnalyticsEventMap {
  subscription_created: SubscriptionCreatedProps;
  subscription_cancelled: SubscriptionCancelledProps;
  kit_activated: KitActivatedProps;
  kit_activation_failed: KitActivationFailedProps;
  kit_deactivated: KitDeactivatedProps;
  kit_deactivation_failed: KitDeactivationFailedProps;
  skill_downloaded: SkillDownloadedProps;
  review_submitted: ReviewSubmittedProps;
  wishlist_item_added: WishlistItemAddedProps;
  wishlist_item_removed: WishlistItemRemovedProps;
}

export type AnalyticsEvent = keyof AnalyticsEventMap;
