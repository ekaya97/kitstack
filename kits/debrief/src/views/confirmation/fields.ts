// Browser-safe: the View bundle imports this, so it must not pull in the SDK runtime.
export const CONFIRMATION_FIELDS = [
  "outcome",
  "next_step",
  "customer_update",
  "discovered_address",
  "follow_up_date",
] as const;

export type ConfirmationField = (typeof CONFIRMATION_FIELDS)[number];
