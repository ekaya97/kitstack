import { describe, expect, it, vi } from "vitest";
import { createTwilioVerifyClient } from "../src/verify.js";

describe("Twilio Verify client", () => {
  it("starts a verification over SMS with Basic auth", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/Verifications");
      expect(init?.headers).toMatchObject({ authorization: expect.stringContaining("Basic ") });
      expect(String(init?.body)).toBe(new URLSearchParams({ To: "+491234567890", Channel: "sms" }).toString());
      return new Response(JSON.stringify({ status: "pending", sid: "VE123" }), { status: 201 });
    });
    const client = createTwilioVerifyClient({ accountSid: "AC123", authToken: "secret", serviceSid: "VAtest", fetch: fetcher });
    await expect(client.start("+491234567890")).resolves.toEqual({ status: "pending", sid: "VE123" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("checks a code and reports approval only when Twilio approves it", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/VerificationCheck");
      expect(String(init?.body)).toBe(new URLSearchParams({ To: "+491234567890", Code: "123456" }).toString());
      return new Response(JSON.stringify({ status: "approved" }), { status: 200 });
    });
    const client = createTwilioVerifyClient({ accountSid: "AC123", authToken: "secret", serviceSid: "VAtest", fetch: fetcher });
    await expect(client.check("+491234567890", "123456")).resolves.toEqual({ status: "approved", approved: true });
  });

  it("reports a rejected code as not approved without throwing", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "pending" }), { status: 200 }));
    const client = createTwilioVerifyClient({ accountSid: "AC123", authToken: "secret", serviceSid: "VAtest", fetch: fetcher });
    await expect(client.check("+491234567890", "000000")).resolves.toEqual({ status: "pending", approved: false });
  });

  it("surfaces a non-2xx Twilio response as an error without leaking credentials", async () => {
    const fetcher = vi.fn(async () => new Response("provider unavailable", { status: 503 }));
    const client = createTwilioVerifyClient({ accountSid: "AC123", authToken: "very-secret", serviceSid: "VAtest", fetch: fetcher });
    await expect(client.start("+491234567890")).rejects.toThrow("Twilio Verify start returned HTTP 503");
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("very-secret");
  });

  it("requires account SID, auth token, and service SID", () => {
    expect(() => createTwilioVerifyClient({ accountSid: "", authToken: "t", serviceSid: "VAtest" })).toThrow("Twilio account SID");
    expect(() => createTwilioVerifyClient({ accountSid: "AC", authToken: "", serviceSid: "VAtest" })).toThrow("Twilio auth token");
    expect(() => createTwilioVerifyClient({ accountSid: "AC", authToken: "t", serviceSid: "" })).toThrow("Twilio Verify service SID");
  });
});
