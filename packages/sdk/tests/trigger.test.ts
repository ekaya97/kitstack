import { describe, expect, it } from "vitest";
import {
  defineTrigger,
  dispatchTrigger,
  type DispatchEnvelope,
  type TriggerAuditEvent,
} from "../src/index";

describe("trigger and channel contracts", () => {
  it("uses the same dispatch envelope shape for HTTP and scheduler invocations", async () => {
    const envelopes: DispatchEnvelope[] = [];
    const audit: TriggerAuditEvent[] = [];
    const trigger = (kind: "http" | "schedule") => defineTrigger({
      id: "after-meeting",
      kind,
      identity: { type: "service", principal: "debrief-scheduler" },
      kits: ["kit:debrief"],
      channel: { kind, id: `trigger:${kind}` },
      verify: kind === "http" ? async () => true : undefined,
      handler: async ({ envelope }, payload: { sessionId: string }) => {
        envelopes.push(envelope);
        return { accepted: true, payload };
      },
    });

    const invoke = (kind: "http" | "schedule") => dispatchTrigger(
      trigger(kind),
      {
        kitId: "kit:debrief",
        payload: { sessionId: "session-1" },
        method: kind === "http" ? "POST" : "INTERNAL",
        path: "/t/kit:debrief/after-meeting",
        headers: kind === "http" ? { "x-signature": "valid" } : {},
        channel: { kind, id: `trigger:${kind}` },
        session: { id: "session-1", traceId: "trace-1", parentId: "parent-1" },
      },
      { audit: async (event) => { audit.push(event); } },
    );

    const [http, scheduled] = await Promise.all([invoke("http"), invoke("schedule")]);

    expect(envelopes).toHaveLength(2);
    for (const envelope of envelopes) {
      expect(envelope.kitId).toBe("kit:debrief");
      expect(envelope.command).toBe("after-meeting");
      expect(envelope.identity).toEqual({ principal: "debrief-scheduler", actor: "debrief-scheduler" });
      expect(envelope.actor).toBe("debrief-scheduler");
      expect(envelope.session).toEqual({ id: "session-1", traceId: "trace-1", parentId: "parent-1" });
    }
    expect(http.envelope.channel).toEqual({ kind: "http", id: "trigger:http" });
    expect(scheduled.envelope.channel).toEqual({ kind: "schedule", id: "trigger:schedule" });
    expect(http.result.isError).toBeUndefined();
    expect(scheduled.result.isError).toBeUndefined();
    expect(audit).toHaveLength(2);
    expect(audit.every((event) => event.outcome === "success")).toBe(true);
  });

  it("rejects an unverified webhook and an out-of-allowlist kit before the handler", async () => {
    let invoked = 0;
    const audit: TriggerAuditEvent[] = [];
    const trigger = defineTrigger({
      id: "twilio-call",
      kind: "webhook" as const,
      identity: { type: "service" as const, principal: "twilio.voice" },
      kits: ["kit:debrief"],
      verify: async () => false,
      handler: async () => { invoked++; return { ok: true }; },
    });

    const rejected = await dispatchTrigger(trigger, {
      kitId: "kit:debrief",
      payload: { CallSid: "CA-1" },
      headers: {},
    }, { audit: async (event) => { audit.push(event); } });
    const outside = await dispatchTrigger(trigger, {
      kitId: "kit:other",
      payload: { CallSid: "CA-2" },
    }, { audit: async (event) => { audit.push(event); } });

    expect(rejected.result.errorCode).toBe("policy_denied");
    expect(outside.result.errorCode).toBe("policy_denied");
    expect(invoked).toBe(0);
    expect(audit.map((event) => event.outcome)).toEqual(["denied", "denied"]);
  });

  it("requires verification for webhook declarations", () => {
    expect(() => defineTrigger({
      id: "unsigned",
      kind: "webhook" as const,
      identity: { type: "service" as const, principal: "provider" },
      kits: ["kit:debrief"],
      handler: async () => ({ ok: true }),
    })).toThrow("webhook triggers require verify");
  });
});
