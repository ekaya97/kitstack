import { describe, expect, it } from "vitest";
import { createManualTrigger, createScheduledTrigger } from "./manual.js";
import { createTwilioVoiceTrigger } from "./twilio.js";

describe("debrief trigger contracts", () => {
  it("declares manual HTTP and Twilio webhook channels with fixed identities", () => {
    const manual = createManualTrigger();
    const twilio = createTwilioVoiceTrigger({ verify: async () => true });

    expect(manual).toMatchObject({
      id: "trigger:manual",
      kind: "http",
      identity: { type: "service", principal: "manual-debrief" },
      kits: ["kit:debrief"],
      channel: { kind: "http" },
    });
    expect(twilio).toMatchObject({
      id: "trigger:twilio-voice",
      kind: "webhook",
      identity: { type: "service", principal: "twilio.voice" },
      kits: ["kit:debrief"],
      channel: { kind: "voice" },
    });
    expect(manual.normalize({ goal: "call", sessionId: "session-1" }).type).toBe("debrief.requested");
    expect(twilio.normalize({ CallSid: "CA-1" }).type).toBe("voice.started");
  });

  it("keeps scheduler invocation on the same trigger contract", async () => {
    const trigger = createScheduledTrigger();
    const result = await trigger.handler(
      { envelope: {} as never },
      { sessionId: "session-1" },
    );
    expect(trigger.channel).toEqual({ kind: "schedule", id: "trigger:scheduler" });
    expect(result).toEqual({
      type: "debrief.requested",
      source: "scheduler",
      payload: { sessionId: "session-1" },
    });
  });
});
