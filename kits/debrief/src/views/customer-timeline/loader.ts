import { defineLoader, type KitContext } from "@kitstackco/sdk";
import type { CustomerEventType } from "../../event-contracts.js";

export interface CustomerTimelineEventSnapshot {
  event_id: string;
  customer_id: string;
  session_id: string;
  type: CustomerEventType;
  occurred_at: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface CustomerTimelineMetadataSnapshot {
  providers?: readonly (string | null | undefined)[];
  models?: readonly (string | null | undefined)[];
  estimated_cost_usd?: number | null;
  latency_ms?: number | null;
}

export interface CustomerTimelineLoaderSnapshot {
  session_id: string;
  customer_id: string;
  company: string;
  contact_name: string;
  location: string;
  events: readonly CustomerTimelineEventSnapshot[];
  provider_metadata?: CustomerTimelineMetadataSnapshot;
}

export interface CustomerTimelineEvent {
  eventId: string;
  customerId: string;
  sessionId: string;
  type: CustomerEventType;
  occurredAt: string;
  summary: string;
  details: Readonly<Record<string, string>>;
}

export interface CustomerTimelineViewData {
  sessionId: string;
  customerId: string;
  customer: {
    company: string;
    contactName: string;
    location: string;
  };
  events: readonly CustomerTimelineEvent[];
  providerMetadata: {
    providers: readonly string[];
    models: readonly string[];
    estimatedCostUsd: number;
    latencyMs: number;
  };
  privacy: {
    transcript: "not retained";
    audio: "not retained";
  };
}

const EMPTY_METADATA: CustomerTimelineViewData["providerMetadata"] = {
  providers: [],
  models: [],
  estimatedCostUsd: 0,
  latencyMs: 0,
};

/**
 * Project customer events into the timeline's explicit, structured contract.
 * Unknown event payload fields are intentionally discarded at this boundary;
 * transcripts, audio, and other provider data cannot enter the View.
 */
export function toCustomerTimelineViewData(
  key: { session_id: string; customer_id: string },
  snapshot: CustomerTimelineLoaderSnapshot,
): CustomerTimelineViewData {
  if (snapshot.session_id !== key.session_id || snapshot.customer_id !== key.customer_id) {
    throw new Error("Customer timeline snapshot does not match the requested session and customer");
  }
  if (!snapshot.session_id.trim() || !snapshot.customer_id.trim()) {
    throw new Error("Customer timeline requires a session and customer");
  }

  return {
    sessionId: snapshot.session_id,
    customerId: snapshot.customer_id,
    customer: {
      company: snapshot.company,
      contactName: snapshot.contact_name,
      location: snapshot.location,
    },
    events: [...snapshot.events]
      .filter((event) => event.customer_id === snapshot.customer_id)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.event_id.localeCompare(a.event_id))
      .map(projectEvent),
    providerMetadata: projectMetadata(snapshot.provider_metadata),
    privacy: {
      transcript: "not retained",
      audio: "not retained",
    },
  };
}

export const loader = defineLoader(async (ctx): Promise<CustomerTimelineViewData> => {
  const sessionId = requiredParam(ctx, "session_id");
  const customerId = requiredParam(ctx, "customer_id");
  const encodedSnapshot = requiredParam(ctx, "snapshot");

  let snapshot: CustomerTimelineLoaderSnapshot;
  try {
    snapshot = JSON.parse(encodedSnapshot) as CustomerTimelineLoaderSnapshot;
  } catch {
    throw new Error("Customer timeline snapshot must be valid JSON");
  }

  return toCustomerTimelineViewData(
    { session_id: sessionId, customer_id: customerId },
    snapshot,
  );
});

function projectEvent(event: CustomerTimelineEventSnapshot): CustomerTimelineEvent {
  const payload = event.payload;
  switch (event.type) {
    case "debrief_confirmed":
      return {
        ...eventIdentity(event),
        summary: "Debrief confirmed.",
        details: strings(payload, ["outcome", "next_step", "customer_update", "follow_up_date"]),
      };
    case "address_discovered":
      return {
        ...eventIdentity(event),
        summary: "Customer address discovered.",
        details: strings(payload, ["address", "source"]),
      };
    case "call_completed":
      return {
        ...eventIdentity(event),
        summary: "Voice call completed.",
        details: strings(payload, ["provider", "reason"]),
      };
    case "note":
      return {
        ...eventIdentity(event),
        summary: "Operator note recorded.",
        details: strings(payload, ["correction", "note"]),
      };
    case "prebrief":
      return {
        ...eventIdentity(event),
        summary: "Sales debrief prepared.",
        details: strings(payload, ["goal", "company", "contact_name", "location"]),
      };
    default:
      throw new Error(`Unsupported customer timeline event: ${String(event.type)}`);
  }
}

function eventIdentity(event: CustomerTimelineEventSnapshot) {
  return {
    eventId: event.event_id,
    customerId: event.customer_id,
    sessionId: event.session_id,
    type: event.type,
    occurredAt: event.occurred_at,
  };
}

function strings(payload: Readonly<Record<string, unknown>>, fields: readonly string[]): Record<string, string> {
  return Object.fromEntries(fields.flatMap((field) => {
    const value = payload[field];
    return typeof value === "string" && value.trim() ? [[field, value]] : [];
  }));
}

function projectMetadata(metadata: CustomerTimelineMetadataSnapshot | undefined): CustomerTimelineViewData["providerMetadata"] {
  if (!metadata) return EMPTY_METADATA;
  return {
    providers: uniqueStrings(metadata.providers),
    models: uniqueStrings(metadata.models),
    estimatedCostUsd: finiteNumber(metadata.estimated_cost_usd),
    latencyMs: finiteNumber(metadata.latency_ms),
  };
}

function uniqueStrings(values: readonly (string | null | undefined)[] | undefined): string[] {
  return [...new Set((values ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
}

function finiteNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function requiredParam(ctx: KitContext, name: string): string {
  const value = ctx.params?.[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Customer timeline View requires params.${name}`);
  return value.trim();
}
