import { describe, expect, it } from "vitest";
import { createKitContext } from "@kitstackco/sdk";
import kit from "../kit.config";
import { loader, toCustomerTimelineViewData, type CustomerTimelineLoaderSnapshot } from "../src/views/customer-timeline/loader";

const snapshot: CustomerTimelineLoaderSnapshot = {
  session_id: "session-1",
  customer_id: "customer-1",
  company: "Acme Corp",
  contact_name: "Mr John Doe",
  location: "Köln Café",
  events: [
    {
      event_id: "prebrief-1",
      customer_id: "customer-1",
      session_id: "session-1",
      type: "prebrief",
      occurred_at: "2026-09-15T20:10:00.000Z",
      payload: { goal: "Close the opportunity", transcript: "must not appear" },
    },
    {
      event_id: "confirmed-1",
      customer_id: "customer-1",
      session_id: "session-1",
      type: "debrief_confirmed",
      occurred_at: "2026-09-15T20:20:00.000Z",
      payload: { outcome: "confirmed", next_step: "Send proposal", audio: "must not appear" },
    },
    {
      event_id: "address-1",
      customer_id: "customer-1",
      session_id: "session-1",
      type: "address_discovered",
      occurred_at: "2026-09-15T20:19:00.000Z",
      payload: { address: "Neue Straße 1, Köln", source: "operator-confirmed" },
    },
    {
      event_id: "other-customer-event",
      customer_id: "customer-2",
      session_id: "session-2",
      type: "debrief_confirmed",
      occurred_at: "2026-09-15T20:30:00.000Z",
      payload: { outcome: "Acme must not see this" },
    },
  ],
  provider_metadata: {
    providers: ["simulator"],
    models: ["simulator-german-sales-v1"],
    estimated_cost_usd: 0.0012,
    latency_ms: 42,
  },
};

describe("customer timeline View", () => {
  it("registers alongside the existing prebrief and confirmation Views", () => {
    expect(kit.views?.map((view) => view.slug)).toEqual(["prebrief", "confirmation", "customer-timeline"]);
    expect(kit.views?.find((view) => view.slug === "customer-timeline")).toMatchObject({
      name: "Customer Timeline",
      description: expect.stringContaining("structured events"),
    });
  });

  it("loads newest-first customer events and summarizes metadata without leaking payloads", async () => {
    const data = await loader(createKitContext({
      db: null as never,
      identity: { principal: "user-1", actor: "user-1" },
      params: {
        session_id: snapshot.session_id,
        customer_id: snapshot.customer_id,
        snapshot: JSON.stringify(snapshot),
      },
    }));

    expect(data.events.map((event) => event.eventId)).toEqual(["confirmed-1", "address-1", "prebrief-1"]);
    expect(data.events[0]).toMatchObject({
      type: "debrief_confirmed",
      details: { outcome: "confirmed", next_step: "Send proposal" },
    });
    expect(data.events[1]).toMatchObject({ type: "address_discovered", details: { address: "Neue Straße 1, Köln" } });
    expect(data.providerMetadata).toEqual({
      providers: ["simulator"],
      models: ["simulator-german-sales-v1"],
      estimatedCostUsd: 0.0012,
      latencyMs: 42,
    });
    expect(JSON.stringify(data)).not.toContain("must not appear");
  });

  it("rejects a snapshot for another active customer/session", () => {
    expect(() => toCustomerTimelineViewData(
      { session_id: "session-other", customer_id: snapshot.customer_id },
      snapshot,
    )).toThrow("does not match");

    const data = toCustomerTimelineViewData(
      { session_id: snapshot.session_id, customer_id: snapshot.customer_id },
      snapshot,
    );
    expect(data.events.every((event) => event.customerId === snapshot.customer_id)).toBe(true);
    expect(data.events.some((event) => event.eventId === "other-customer-event")).toBe(false);
  });
});
