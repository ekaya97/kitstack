import { describe, expect, it, vi } from "vitest";
import { REALTIME_PROVIDER, runExternalSmoke, resolveVoiceProviderConfig, startProviderCall } from "./provider.js";

function fixture() {
  return {
    telemetry: { append: vi.fn(async (event: any) => event) },
    base: { sessionId: "session-1", orgId: "org-demo", appId: "app-sales" },
  };
}

describe("voice provider boundary", () => {
  it("defaults to the deterministic simulator with privacy disabled", () => {
    expect(resolveVoiceProviderConfig()).toMatchObject({ provider: "simulator", recording: false, retention: false });
  });

  it("requires explicit realtime endpoints and keeps privacy disabled", () => {
    expect(resolveVoiceProviderConfig({ provider: REALTIME_PROVIDER, realtime: { twilioMediaStreamsUrl: "wss://twilio.example/stream", openaiRealtimeUrl: "https://openai.example/realtime" } })).toMatchObject({ provider: "realtime", model: "gpt-4o-realtime-preview", recording: false, retention: false });
    expect(() => resolveVoiceProviderConfig({ provider: REALTIME_PROVIDER })).toThrow(/requires/);
  });

  it("returns a deterministic boundary and records recording-off/retention-off", async () => {
    const f = fixture();
    const result = await startProviderCall({ ...f.base, telemetry: f.telemetry, createId: (() => { let n = 0; return () => `id-${++n}`; })(), now: () => "2026-01-01T00:00:00.000Z" });
    expect(result).toMatchObject({ callId: "id-1", provider: "simulator", status: "ready", recording: false, retention: false });
    expect(f.telemetry.append).toHaveBeenCalledWith(expect.objectContaining({ operation: "start:recording-off:retention-off", type: "voice.call", outcome: "started" }));
    expect(JSON.stringify({ result, event: f.telemetry.append.mock.calls[0][0] })).not.toMatch(/transcript|audioBody|audioData|body/i);
  });
});

describe("external voice smoke gate", () => {
  it("is blocked when external values are absent", async () => {
    await expect(runExternalSmoke()).resolves.toMatchObject({ status: "blocked", live: false, publicHttps: { status: "blocked" }, publicWss: { status: "blocked" }, claudeMcp: { status: "blocked" } });
  });

  it("checks HTTPS and Claude MCP through injected fetch", async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200 }));
    const result = await runExternalSmoke({ publicHttpsUrl: "https://demo.example", publicWssUrl: "wss://demo.example/stream", claudeMcpUrl: "https://demo.example/mcp", fetch });
    expect(result).toMatchObject({ status: "green", live: false, publicHttps: { status: "pass" }, publicWss: { status: "pass" }, claudeMcp: { status: "pass" } });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("reports injected reachability failures without claiming green", async () => {
    const result = await runExternalSmoke({ publicHttpsUrl: "https://demo.example", publicWssUrl: "wss://demo.example/stream", claudeMcpUrl: "https://demo.example/mcp", fetch: vi.fn(async () => ({ ok: false, status: 503 })) });
    expect(result).toMatchObject({ status: "failed", live: false, publicHttps: { status: "fail" }, claudeMcp: { status: "fail" } });
  });
});
