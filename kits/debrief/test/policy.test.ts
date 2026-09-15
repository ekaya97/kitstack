import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  createDebriefSession,
} from "../src/agent/policy";
import { createMemoryQuery } from "../src/memory";

describe("debrief policies", () => {
  it("models the prepared-to-confirmed workflow boundaries", () => {
    expect(canTransition("prepared", "calling")).toBe(true);
    expect(canTransition("prepared", "confirmed")).toBe(false);
    expect(() => assertTransition("prepared", "confirmed")).toThrow(
      "Invalid debrief transition prepared -> confirmed",
    );
  });

  it("creates a scoped session and memory query without host details", () => {
    const session = createDebriefSession({
      sessionId: "session-1",
      orgId: "org-1",
      goal: "Understand the renewal risk",
      instructionVersion: "0.1.0",
      now: "2026-09-15T00:00:00.000Z",
    });
    const query = createMemoryQuery({ orgId: session.orgId, sessionId: session.sessionId });

    expect(session.kitId).toBe("kit:debrief");
    expect(session.state).toBe("prepared");
    expect(query).toMatchObject({ orgId: "org-1", skill: "debrief", limit: 20 });
  });
});
