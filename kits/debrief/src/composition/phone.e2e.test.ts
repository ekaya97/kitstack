import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoApp, type DemoApp } from "./app/index.js";
import { kitCall, mcpRequest } from "../transports/test-support.js";

let app: DemoApp | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

const FAKE_CODE = "998877";

/** Fake Twilio Verify REST API: approves only the configured code. */
function fakeTwilioVerifyFetch(code = FAKE_CODE) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/Verifications")) {
      return new Response(JSON.stringify({ status: "pending", sid: "VE1" }), { status: 201 });
    }
    if (url.endsWith("/VerificationCheck")) {
      const body = new URLSearchParams(String(init?.body));
      const approved = body.get("Code") === code;
      return new Response(JSON.stringify({ status: approved ? "approved" : "pending" }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
}

async function call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await mcpRequest(app!, { body: { id: 1, method: "tools/call", params: kitCall(name, args) } });
  const result = (response.body as any).result;
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text) as T;
}

function callback() {
  return { callback_at: new Date(Date.now() + 3_600_000).toISOString(), callback_timezone: "Europe/Berlin" };
}

describe("self-service phone verification", () => {
  it("rejects a disallowed country before ever starting verification", async () => {
    app = await createDemoApp({ url: ":memory:", twilioVerify: { accountSid: "AC1", authToken: "t", serviceSid: "VA1", fetch: fakeTwilioVerifyFetch() } });
    await expect(call("register_phone", { phone: "+12025550123" })).rejects.toThrow("allowed country");
    await expect(call("get_phone")).resolves.toEqual({ registered: false, verified: false });
  });

  it("refuses a callback debrief without a verified number, then succeeds once register_phone/verify_phone complete", async () => {
    app = await createDemoApp({ url: ":memory:", twilioVerify: { accountSid: "AC1", authToken: "t", serviceSid: "VA1", fetch: fakeTwilioVerifyFetch() } });
    await expect(call("prepare_debrief", {
      goal: "Debrief the call", company: "Acme Corp", contact_name: "Jane Doe", location: "Köln", ...callback(),
    })).rejects.toThrow("register_phone and verify_phone");

    await expect(call("register_phone", { phone: "+491701234567" })).resolves.toEqual({ status: "sent" });
    await expect(call("get_phone")).resolves.toMatchObject({ registered: true, verified: false });
    await expect(call("verify_phone", { phone: "+491701234567", code: FAKE_CODE })).resolves.toEqual({ status: "verified" });
    await expect(call("get_phone")).resolves.toMatchObject({ registered: true, verified: true, maskedNumber: "+49********67" });

    const prepared = await call("prepare_debrief", {
      goal: "Debrief the call", company: "Acme Corp", contact_name: "Jane Doe", location: "Köln", ...callback(),
    });
    expect(prepared.state).toBe("prepared");

    await call("remove_phone");
    await expect(call("get_phone")).resolves.toEqual({ registered: false, verified: false });
  });

  it("keeps rehearsal working with no phone number registered at all", async () => {
    app = await createDemoApp({ url: ":memory:" });
    await expect(call("prepare_rehearsal", { goal: "Rehearse the pitch" })).resolves.toMatchObject({ state: "prepared" });
  });

  it("falls back to the operator destination for the operator org without requiring a verified number", async () => {
    app = await createDemoApp({ url: ":memory:", operatorFallback: { destination: "+491234567890" } });
    const prepared = await call("prepare_debrief", {
      goal: "Debrief the call", company: "Acme Corp", contact_name: "Jane Doe", location: "Köln", ...callback(),
    });
    expect(prepared.state).toBe("prepared");
  });

  it("refuses to schedule more than 5 calls for the same owner within 24 hours", async () => {
    app = await createDemoApp({ url: ":memory:", operatorFallback: { destination: "+491234567890" } });
    for (let i = 0; i < 5; i += 1) {
      const prepared = await call("prepare_debrief", {
        goal: "Debrief the call", company: `Customer ${i}`, contact_name: "Jane Doe", location: "Köln", ...callback(),
      });
      expect(prepared.state).toBe("prepared");
    }
    await expect(call("prepare_debrief", {
      goal: "Debrief the call", company: "Customer 6", contact_name: "Jane Doe", location: "Köln", ...callback(),
    })).rejects.toThrow("Daily call limit reached");
  });
});
