import { describe, expect, it } from "vitest";
import kit from "../kit.config";
import { loader, toPrebriefViewData, type PrebriefLoaderSnapshot } from "../src/views/prebrief/loader";

const snapshot: PrebriefLoaderSnapshot = {
  session_id: "session-1",
  customer_id: "customer-1",
  company: "Acme Corp",
  contact_name: "Mr John Doe",
  location: "Köln Café",
  prebrief: "No prior customer history is available yet.",
  prebrief_sections: {
    known: ["Company: Acme Corp", "Contact: Mr John Doe", "Location: Köln Café"],
    last_interaction: "No prior interaction recorded.",
    open_items: ["No open items recorded."],
    call_objective: "Prepare the next sales conversation",
  },
  prebrief_ends_at: "2026-09-15T20:05:00.000Z",
  scheduled_call_at: "2026-09-15T20:10:00.000Z",
  destination_masked: "configured demo destination",
};

describe("debrief prebrief View", () => {
  it("is registered with the kit and exposes the virtual-router metadata contract", () => {
    expect(kit.views?.map((view) => view.slug)).toEqual(["prebrief", "confirmation", "customer-timeline"]);
    expect(kit.views?.[0]).toMatchObject({
      name: "Sales Prebrief",
      description: expect.stringContaining("customer context"),
    });
  });

  it("loads a keyed snapshot and makes empty history explicit", async () => {
    const data = await loader(null as never, {
      userId: "user-1",
      kitId: "debrief",
      params: {
        session_id: snapshot.session_id,
        customer_id: snapshot.customer_id,
        snapshot: JSON.stringify(snapshot),
      },
    });

    expect(data).toMatchObject({
      sessionId: "session-1",
      customerId: "customer-1",
      customer: { company: "Acme Corp", contactName: "Mr John Doe", location: "Köln Café" },
      lastInteraction: "No prior interaction recorded.",
      relevantHistory: [],
      scheduledCallAt: snapshot.scheduled_call_at,
      privacy: { destination: "masked", transcript: "not retained", audio: "not retained" },
    });
    expect(JSON.stringify(data)).not.toContain("+491234567890");
  });

  it("rejects a snapshot for another session/customer or an unmasked destination", () => {
    expect(() => toPrebriefViewData(
      { session_id: "other-session", customer_id: snapshot.customer_id },
      snapshot,
    )).toThrow("does not match");

    expect(() => toPrebriefViewData(
      { session_id: snapshot.session_id, customer_id: snapshot.customer_id },
      { ...snapshot, destination_masked: "+491234567890" },
    )).toThrow("already-masked");
  });
});
