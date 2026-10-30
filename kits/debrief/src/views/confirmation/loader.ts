import { defineLoader, type KitContext } from "@kitstackco/sdk";

import { CONFIRMATION_FIELDS, type ConfirmationField } from "./fields";

export { CONFIRMATION_FIELDS, type ConfirmationField } from "./fields";

export interface ConfirmationDraftSnapshot {
  draft_id: string;
  session_id: string;
  status: "draft" | "confirmed" | "partial";
  fields: Readonly<Record<string, unknown>>;
  updated_at: string;
}

export interface PreviousDebriefSnapshot {
  session_id: string;
  confirmed_at: string;
  fields: Readonly<Record<string, unknown>>;
}

export interface PreviousDebriefView {
  sessionId: string;
  confirmedAt: string;
  fields: Record<ConfirmationField, string>;
}

export interface ConfirmationLoaderSnapshot {
  session_id: string;
  customer_id: string | null;
  state: "awaiting_confirmation" | "partial" | "confirmed";
  draft: ConfirmationDraftSnapshot;
  confirmed_event_id?: string;
  address_event_id?: string;
  previous_debriefs?: readonly PreviousDebriefSnapshot[];
  kit_view?: { kit_id: "debrief"; view: "confirmation"; reason?: string };
}

export interface ConfirmationViewData {
  sessionId: string;
  customerId: string | null;
  state: ConfirmationLoaderSnapshot["state"];
  draft: ConfirmationDraftSnapshot;
  confirmedEventId: string | null;
  addressEventId: string | null;
  /** The customer's earlier confirmed debriefs, newest first. */
  previousDebriefs: PreviousDebriefView[];
}

export const loader = defineLoader(async (ctx): Promise<ConfirmationViewData> => {
  const sessionId = requiredParam(ctx, "session_id");
  const encodedSnapshot = requiredParam(ctx, "snapshot");
  let snapshot: ConfirmationLoaderSnapshot;
  try {
    snapshot = JSON.parse(encodedSnapshot) as ConfirmationLoaderSnapshot;
  } catch {
    throw new Error("Confirmation View snapshot must be valid JSON");
  }
  if (snapshot.session_id !== sessionId) throw new Error("Confirmation View snapshot does not match the requested session");
  return toConfirmationViewData(snapshot);
});

export function toConfirmationViewData(snapshot: ConfirmationLoaderSnapshot): ConfirmationViewData {
  if (!snapshot.session_id.trim()) throw new Error("Confirmation View requires a session");
  if (snapshot.draft.session_id !== snapshot.session_id) throw new Error("Confirmation draft does not match the requested session");
  return {
    sessionId: snapshot.session_id,
    customerId: snapshot.customer_id,
    state: snapshot.state,
    draft: {
      ...snapshot.draft,
      fields: Object.fromEntries(CONFIRMATION_FIELDS.map((field) => [field, stringValue(snapshot.draft.fields[field])])),
    },
    confirmedEventId: snapshot.confirmed_event_id ?? null,
    addressEventId: snapshot.address_event_id ?? null,
    // Only the listed fields reach the View, as for the draft.
    previousDebriefs: (snapshot.previous_debriefs ?? []).map((entry) => ({
      sessionId: entry.session_id,
      confirmedAt: entry.confirmed_at,
      fields: Object.fromEntries(CONFIRMATION_FIELDS.map((field) => [field, stringValue(entry.fields[field])])) as Record<ConfirmationField, string>,
    })),
  };
}

function requiredParam(ctx: KitContext, name: string): string {
  const value = ctx.params?.[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Confirmation View requires params.${name}`);
  return value.trim();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
