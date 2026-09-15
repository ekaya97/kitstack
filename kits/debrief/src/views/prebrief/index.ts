import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { PrebriefView } from "./View";

export { loader } from "./loader";
export type {
  PrebriefLoaderSnapshot,
  PrebriefSectionsSnapshot,
  PrebriefViewData,
} from "./loader";

export default defineView({
  slug: "prebrief",
  name: "Sales Prebrief",
  description: "before the scheduled sales call, to review customer context, history, objective, timing, and privacy status",
  loader,
  component: PrebriefView,
  height: 720,
  placeholder: {
    sessionId: "session-preview",
    customerId: "customer-acme",
    customer: { company: "Acme Corp", contactName: "Mr John Doe", location: "Köln Café" },
    summary: "No prior customer history is available yet.",
    known: ["Company: Acme Corp", "Contact: Mr John Doe", "Location: Köln Café"],
    lastInteraction: "No prior interaction recorded.",
    relevantHistory: [],
    openItems: ["No open items recorded."],
    objective: "Prepare the next sales conversation",
    prebriefEndsAt: "2026-09-15T20:05:00.000Z",
    scheduledCallAt: "2026-09-15T20:10:00.000Z",
    destinationMasked: "configured demo destination",
    privacy: { destination: "masked", transcript: "not retained", audio: "not retained" },
    provider: { name: "Twilio + OpenAI Realtime", status: "scheduled" },
  },
});
