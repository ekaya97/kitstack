import { describe, expect, it } from "vitest";
import { createKitContext } from "@kitstackco/sdk";
import kit from "../kit.config";
import { loader, toConfirmationViewData, type ConfirmationLoaderSnapshot } from "../src/views/confirmation/loader";

const snapshot: ConfirmationLoaderSnapshot = {
  session_id: "session-1",
  customer_id: "customer-1",
  state: "awaiting_confirmation",
  draft: {
    draft_id: "draft-1",
    session_id: "session-1",
    status: "draft",
    fields: { next_step: "Send proposal", discovered_address: "Neue Straße 1" },
    updated_at: "2026-09-15T20:15:00.000Z",
  },
};

describe("debrief confirmation View", () => {
  it("loads the keyed editable draft", async () => {
    const data = await loader(createKitContext({
      db: null as never,
      identity: { principal: "user-1", actor: "user-1" },
      params: { session_id: snapshot.session_id, snapshot: JSON.stringify(snapshot) },
    }));
    expect(data).toMatchObject({
      sessionId: "session-1",
      state: "awaiting_confirmation",
      draft: { fields: { next_step: "Send proposal", discovered_address: "Neue Straße 1", outcome: "" } },
    });
  });

  it("passes earlier confirmed debriefs through with only the debrief fields", () => {
    const data = toConfirmationViewData({
      ...snapshot,
      previous_debriefs: [{
        session_id: "session-0",
        confirmed_at: "2026-09-01T16:30:00.000Z",
        fields: { outcome: "Interested", next_step: "Send deck", transcript: "never shown" },
      }],
    });
    expect(data.previousDebriefs).toEqual([{
      sessionId: "session-0",
      confirmedAt: "2026-09-01T16:30:00.000Z",
      fields: { outcome: "Interested", next_step: "Send deck", customer_update: "", discovered_address: "", follow_up_date: "" },
    }]);
    expect(toConfirmationViewData(snapshot).previousDebriefs).toEqual([]);
  });

  it("rejects a draft for another session", () => {
    expect(() => toConfirmationViewData({ ...snapshot, session_id: "other-session" })).toThrow("does not match");
  });

  it("registers the confirmation View", () => {
    expect(kit.views?.find((view) => view.slug === "confirmation")).toMatchObject({
      name: "Debrief Confirmation",
      description: expect.stringContaining("confirm customer events"),
    });
  });
});
