import { describe, expect, it, vi } from "vitest";
import { handleLiveVoiceStart, handleVoiceProviderStatus, handleVoiceTwimlRequest, startScheduledLiveVoiceCall } from "./voice.js";

describe("live voice HTTP adapters", () => {
  it("starts only through the injected provider and returns a connecting boundary", async () => {
    const telemetry = { append: vi.fn(async (event: any) => event) };
    const result = await handleLiveVoiceStart({ method: "POST", path: "/t/voice/live/start", body: { session_id: "session-1", to: "+491234567890" } }, {
      twilio: { createCall: vi.fn(async (request) => { expect(request.record).toBe(false); return { sid: "CA123" }; }) }, telemetry,
      orgId: "org-demo", appId: "app-sales", mediaStreamUrl: "wss://demo.example/media", fromNumber: "+491234567891",
      sessionTokenFor: vi.fn(async (sessionId) => { expect(sessionId).toBe("session-1"); return "signed-session"; }),
    });
    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({ callId: "CA123", status: "connecting" });
  });

  it("returns TwiML for Twilio without putting the token in the URL", () => {
    const result = handleVoiceTwimlRequest({ method: "POST", path: "/t/voice/twiml", body: { session_token: "signed-session" } }, { mediaStreamUrl: "wss://demo.example/media" });
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("text/xml");
    expect(result.body).toContain("<Parameter name=\"kitstack_session_token\" value=\"signed-session\"/>");
    expect(result.body).not.toContain("?token=");
  });

  it("does not claim success when the call provider fails", async () => {
    const telemetry = { append: vi.fn(async (event: any) => event) };
    await expect(handleLiveVoiceStart({ method: "POST", path: "/t/voice/live/start", body: { session_id: "session-1", to: "+491234567890" } }, {
      twilio: { createCall: vi.fn(async () => { throw new Error("Twilio unavailable"); }) }, telemetry,
      orgId: "org-demo", appId: null, mediaStreamUrl: "wss://demo.example/media", fromNumber: "+491234567891",
      sessionTokenFor: async () => "signed-session",
    })).rejects.toThrow("Twilio unavailable");
    expect(telemetry.append).toHaveBeenCalledWith(expect.objectContaining({ operation: "outbound_call_error:recording-off:retention-off", outcome: "error" }));
  });

  it("uses the same allowlisted provider seam for a scheduled call and binds its SID", async () => {
    const createCall = vi.fn(async () => ({ sid: "CA-scheduled" }));
    const beforeStart = vi.fn(async () => undefined);
    const onProviderStart = vi.fn(async () => undefined);
    const result = await startScheduledLiveVoiceCall("session-1", {
      twilio: { createCall }, telemetry: { append: vi.fn(async (event: any) => event) },
      orgId: "org-demo", appId: null, mediaStreamUrl: "wss://demo.example/media", fromNumber: "+491234567891",
      allowedDestinations: ["+491234567890"], sessionTokenFor: async () => "signed-session",
      beforeStart, onProviderStart,
    });
    expect(result.callId).toBe("CA-scheduled");
    expect(createCall).toHaveBeenCalledOnce();
    expect(beforeStart).toHaveBeenCalledWith("session-1");
    expect(onProviderStart).toHaveBeenCalledWith("session-1", "CA-scheduled");
  });

  it("validates signed provider status callbacks and resolves the persisted session", async () => {
    const validator = { validate: vi.fn(() => true) };
    const onProviderStatus = vi.fn(async () => undefined);
    const result = await handleVoiceProviderStatus({
      method: "POST", path: "/t/voice/provider-status", headers: { "x-twilio-signature": "signed" },
      body: { CallSid: "CA-scheduled", CallStatus: "in-progress" },
    }, {
      twilio: { createCall: vi.fn() }, telemetry: { append: vi.fn(async (event: any) => event) },
      orgId: "org-demo", appId: null, mediaStreamUrl: "wss://demo.example/media", fromNumber: "+491234567891",
      sessionTokenFor: async () => "signed-session", statusCallback: { validator, url: "https://demo.example/t/voice/provider-status" },
      resolveSessionIdForCallId: async (callId) => callId === "CA-scheduled" ? "session-1" : null, onProviderStatus,
    });
    expect(result).toMatchObject({ status: 200, body: { call_id: "CA-scheduled", status: "connected", session_id: "session-1" } });
    expect(validator.validate).toHaveBeenCalledWith(expect.objectContaining({ url: "https://demo.example/t/voice/provider-status", signature: "signed" }));
    expect(onProviderStatus).toHaveBeenCalledWith({ callId: "CA-scheduled", status: "connected", rawStatus: "in-progress", sessionId: "session-1" });

    const rejected = await handleVoiceProviderStatus({ method: "POST", path: "/t/voice/provider-status", headers: { "x-twilio-signature": "bad" }, body: { CallSid: "CA-scheduled", CallStatus: "completed" } }, {
      twilio: { createCall: vi.fn() }, telemetry: { append: vi.fn(async (event: any) => event) },
      orgId: "org-demo", appId: null, mediaStreamUrl: "wss://demo.example/media", fromNumber: "+491234567891",
      sessionTokenFor: async () => "signed-session", statusCallback: { validator: { validate: () => false }, url: "https://demo.example/t/voice/provider-status" },
    });
    expect(rejected.status).toBe(403);
  });
});
