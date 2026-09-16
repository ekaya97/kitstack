import { defineLoader, type KitContext } from "@kitstackco/sdk";

export interface PrebriefSectionsSnapshot {
  known: readonly string[];
  last_interaction: string;
  relevant_history?: readonly string[];
  open_items: readonly string[];
  call_objective: string;
}

/** The host-facing payload used to hydrate the prebrief View. */
export interface PrebriefLoaderSnapshot {
  session_id: string;
  customer_id: string;
  company: string;
  contact_name: string;
  location: string;
  prebrief?: string;
  prebrief_sections: PrebriefSectionsSnapshot;
  prebrief_ends_at: string;
  scheduled_call_at: string;
  destination_masked: string;
  provider_status?: "scheduled" | "calling" | "completed" | "unavailable";
  provider_name?: string;
}

export interface PrebriefViewData {
  sessionId: string;
  customerId: string;
  customer: {
    company: string;
    contactName: string;
    location: string;
  };
  summary: string | null;
  known: readonly string[];
  lastInteraction: string;
  relevantHistory: readonly string[];
  openItems: readonly string[];
  objective: string;
  prebriefEndsAt: string;
  scheduledCallAt: string;
  destinationMasked: string;
  privacy: {
    destination: "masked";
    transcript: "not retained";
    audio: "not retained";
  };
  provider: {
    name: string;
    status: "scheduled" | "calling" | "completed" | "unavailable";
  };
}

export const EMPTY_HISTORY = "No prior interaction recorded.";

/**
 * Convert the presenter response into the stable, View-safe data contract.
 * Only the explicitly listed fields are copied; transcripts, audio, and raw
 * destinations cannot enter the View payload.
 */
export function toPrebriefViewData(
  key: { session_id: string; customer_id: string },
  snapshot: PrebriefLoaderSnapshot,
): PrebriefViewData {
  if (snapshot.session_id !== key.session_id || snapshot.customer_id !== key.customer_id) {
    throw new Error("Prebrief View snapshot does not match the requested session and customer");
  }
  if (!snapshot.destination_masked.trim() || looksLikeUnmaskedDestination(snapshot.destination_masked)) {
    throw new Error("Prebrief View requires an already-masked destination");
  }

  const history = snapshot.prebrief_sections.relevant_history ?? [];
  return {
    sessionId: snapshot.session_id,
    customerId: snapshot.customer_id,
    customer: {
      company: snapshot.company,
      contactName: snapshot.contact_name,
      location: snapshot.location,
    },
    summary: snapshot.prebrief?.trim() || null,
    known: snapshot.prebrief_sections.known,
    lastInteraction: snapshot.prebrief_sections.last_interaction || EMPTY_HISTORY,
    relevantHistory: history,
    openItems: snapshot.prebrief_sections.open_items,
    objective: snapshot.prebrief_sections.call_objective,
    prebriefEndsAt: snapshot.prebrief_ends_at,
    scheduledCallAt: snapshot.scheduled_call_at,
    destinationMasked: snapshot.destination_masked,
    privacy: {
      destination: "masked",
      transcript: "not retained",
      audio: "not retained",
    },
    provider: {
      name: snapshot.provider_name ?? "Twilio + OpenAI Realtime",
      status: snapshot.provider_status ?? "scheduled",
    },
  };
}

function requiredParam(ctx: KitContext, name: string): string {
  const value = ctx.params?.[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Prebrief View requires params.${name}`);
  return value.trim();
}

/**
 * The virtual debrief adapter supplies the keyed snapshot as JSON in params.
 * Keeping the loader on the SDK LoaderFn contract lets the same View bundle
 * run locally and behind the voice-service adapter.
 */
export const loader = defineLoader(async (ctx): Promise<PrebriefViewData> => {
  const sessionId = requiredParam(ctx, "session_id");
  const customerId = requiredParam(ctx, "customer_id");
  const encodedSnapshot = requiredParam(ctx, "snapshot");

  let snapshot: PrebriefLoaderSnapshot;
  try {
    snapshot = JSON.parse(encodedSnapshot) as PrebriefLoaderSnapshot;
  } catch {
    throw new Error("Prebrief View snapshot must be valid JSON");
  }

  return toPrebriefViewData(
    { session_id: sessionId, customer_id: customerId },
    snapshot,
  );
});

function looksLikeUnmaskedDestination(value: string): boolean {
  return /\+?\d[\d\s().-]{6,}\d/.test(value);
}
