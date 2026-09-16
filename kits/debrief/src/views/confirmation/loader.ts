import { defineLoader, type KitContext } from "@kitstackco/sdk";

export const CONFIRMATION_FIELDS = [
  "outcome",
  "next_step",
  "customer_update",
  "discovered_address",
  "follow_up_date",
] as const;

export type ConfirmationField = (typeof CONFIRMATION_FIELDS)[number];

export interface ConfirmationDraftSnapshot {
  draft_id: string;
  session_id: string;
  status: "draft" | "confirmed" | "partial";
  fields: Readonly<Record<string, unknown>>;
  updated_at: string;
}

export interface ConfirmationLoaderSnapshot {
  session_id: string;
  customer_id: string | null;
  state: "awaiting_confirmation" | "partial" | "confirmed";
  draft: ConfirmationDraftSnapshot;
  confirmed_event_id?: string;
  address_event_id?: string;
  kit_view?: { kit_id: "debrief"; view: "confirmation"; reason?: string };
}

export interface ConfirmationViewData {
  sessionId: string;
  customerId: string | null;
  state: ConfirmationLoaderSnapshot["state"];
  draft: ConfirmationDraftSnapshot;
  confirmedEventId: string | null;
  addressEventId: string | null;
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
