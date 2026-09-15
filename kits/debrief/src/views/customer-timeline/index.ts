import { defineView } from "@kitstackco/sdk";
import { CustomerTimelineView } from "./View";
import { loader } from "./loader";

export { loader } from "./loader";
export type {
  CustomerTimelineEvent,
  CustomerTimelineEventSnapshot,
  CustomerTimelineLoaderSnapshot,
  CustomerTimelineMetadataSnapshot,
  CustomerTimelineViewData,
} from "./loader";

export default defineView({
  slug: "customer-timeline",
  name: "Customer Timeline",
  description: "after confirmation, to review the customer's newest structured events",
  loader,
  component: CustomerTimelineView,
  height: 760,
  placeholder: {
    sessionId: "session-preview",
    customerId: "customer-acme",
    customer: { company: "Acme Corp", contactName: "Mr John Doe", location: "Köln Café" },
    events: [
      {
        eventId: "debrief-confirmed-preview",
        customerId: "customer-acme",
        sessionId: "session-preview",
        type: "debrief_confirmed" as const,
        occurredAt: "2026-09-15T20:20:00.000Z",
        summary: "Debrief confirmed.",
        details: { outcome: "confirmed", next_step: "Send proposal" },
      },
      {
        eventId: "address-discovered-preview",
        customerId: "customer-acme",
        sessionId: "session-preview",
        type: "address_discovered" as const,
        occurredAt: "2026-09-15T20:19:00.000Z",
        summary: "Customer address discovered.",
        details: { address: "Neue Straße 1, Köln" },
      },
    ],
    providerMetadata: { providers: ["simulator"], models: ["simulator-german-sales-v1"], estimatedCostUsd: 0, latencyMs: 0 },
    privacy: { transcript: "not retained" as const, audio: "not retained" as const },
  },
});
