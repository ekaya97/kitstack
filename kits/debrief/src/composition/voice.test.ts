import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoApp, type DemoApp } from "./app/index.js";
import { createBoundDebriefKit } from "./kit.js";
import { createDebriefKitServer } from "./host.js";
import { createDebriefVoiceChannel } from "./voice.js";

let app: DemoApp | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

const FAKE_CODE = "998877";

const BASE_ENV: NodeJS.ProcessEnv = {
  TWILIO_ACCOUNT_SID: "AC1",
  TWILIO_AUTH_TOKEN: "secret",
  TWILIO_FROM_NUMBER: "+4915100000000",
  KITSTACK_DEMO_PUBLIC_HTTPS_URL: "https://voice.test",
  OPENAI_API_KEY: "sk-test",
};

function fakeTwilioVerifyFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/Verifications")) return new Response(JSON.stringify({ status: "pending" }), { status: 201 });
    const body = new URLSearchParams(String(init?.body));
    const approved = body.get("Code") === FAKE_CODE;
    return new Response(JSON.stringify({ status: approved ? "approved" : "pending" }), { status: 200 });
  }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
}

describe("createDebriefVoiceChannel scheduled-call destination resolution", () => {
  it("dials the session owner's verified number instead of the static operator allowlist", async () => {
    app = await createDemoApp({
      url: ":memory:",
      twilioVerify: { accountSid: "AC1", authToken: "t", serviceSid: "VA1", fetch: fakeTwilioVerifyFetch() },
    });
    await app.phone.register(app.orgId, "user-1", "+491701234567");
    await app.phone.verifyCode(app.orgId, "user-1", "+491701234567", FAKE_CODE);

    const prepared = await app.debrief.prepareDebrief({
      goal: "Debrief the call",
      company: "Acme Corp",
      contactName: "Jane Doe",
      location: "Köln",
      callbackAt: new Date(Date.now() + 3_600_000).toISOString(),
      callbackTimezone: "Europe/Berlin",
      ownerId: "user-1",
    });

    const kit = createBoundDebriefKit(app);
    const executor = createDebriefKitServer(app, { transport: "http" }, kit);
    const twilioFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("To")).toBe("+491701234567");
      return new Response(JSON.stringify({ sid: "CA-owner" }), { status: 201 });
    }) as unknown as typeof fetch;

    // A stale operator-destination env var must not win over the owner's verified number.
    const env = { ...BASE_ENV, KITSTACK_DEMO_ALLOWED_DESTINATION: "+499999999999" };
    const channel = await createDebriefVoiceChannel(app, kit, executor, { twilioFetch }, env, undefined);
    if (!channel) throw new Error("Voice channel was not created");

    const result = await channel.startCall(prepared.sessionId);
    expect(result.callId).toBe("CA-owner");
    expect(twilioFetch).toHaveBeenCalledOnce();
  });

  it("falls back to the operator destination for the operator org when the owner has no verified number", async () => {
    app = await createDemoApp({ url: ":memory:", orgId: "org-demo", operatorFallback: { destination: "+491234567890" } });
    // No phone registered for "default-user": prepareDebrief only allows this
    // because the operator fallback covers org-demo.
    const prepared = await app.debrief.prepareDebrief({
      goal: "Debrief the call",
      company: "Acme Corp",
      contactName: "Jane Doe",
      location: "Köln",
      callbackAt: new Date(Date.now() + 3_600_000).toISOString(),
      callbackTimezone: "Europe/Berlin",
      ownerId: "default-user",
    });

    const kit = createBoundDebriefKit(app);
    const executor = createDebriefKitServer(app, { transport: "http" }, kit);
    const twilioFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("To")).toBe("+491234567890");
      return new Response(JSON.stringify({ sid: "CA-fallback" }), { status: 201 });
    }) as unknown as typeof fetch;

    const env = { ...BASE_ENV, KITSTACK_DEMO_ALLOWED_DESTINATION: "+491234567890" };
    const channel = await createDebriefVoiceChannel(app, kit, executor, { twilioFetch }, env, undefined);
    if (!channel) throw new Error("Voice channel was not created");

    const result = await channel.startCall(prepared.sessionId);
    expect(result.callId).toBe("CA-fallback");
  });

  it("dials a prospect in their own organization and never rings the operator for an owner without a number", async () => {
    app = await createDemoApp({
      url: ":memory:", orgId: "org-demo", operatorFallback: { destination: "+491234567890" },
      twilioVerify: { accountSid: "AC1", authToken: "t", serviceSid: "VA1", fetch: fakeTwilioVerifyFetch() },
    });
    const prospect = await app.tenants.forOrg("org-user-prospect");
    await prospect.phone.register("org-user-prospect", "prospect", "+436601234567");
    await prospect.phone.verifyCode("org-user-prospect", "prospect", "+436601234567", FAKE_CODE);
    const input = {
      goal: "Debrief the call", company: "Acme Corp", contactName: "Jane Doe", location: "Wien",
      callbackAt: new Date(Date.now() + 3_600_000).toISOString(), callbackTimezone: "Europe/Vienna", ownerId: "prospect",
    };
    const prepared = await prospect.debrief.prepareDebrief(input);

    const kit = createBoundDebriefKit(app);
    const executor = createDebriefKitServer(app, { transport: "http" }, kit);
    const dialled: string[] = [];
    const twilioFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      dialled.push(new URLSearchParams(String(init?.body)).get("To") ?? "");
      return new Response(JSON.stringify({ sid: `CA-${dialled.length}` }), { status: 201 });
    }) as unknown as typeof fetch;
    const env = { ...BASE_ENV, KITSTACK_DEMO_ALLOWED_DESTINATION: "+491234567890" };
    const channel = await createDebriefVoiceChannel(app, kit, executor, { twilioFetch }, env, undefined);
    if (!channel) throw new Error("Voice channel was not created");

    await channel.startCall(prepared.sessionId);
    expect(dialled).toEqual(["+436601234567"]);

    // The number is removed after preparing: the call fails rather than
    // falling back to the operator's phone.
    const second = await prospect.debrief.prepareDebrief({ ...input, company: "Beta GmbH" });
    await prospect.phone.remove("org-user-prospect", "prospect");
    await expect(channel.startCall(second.sessionId)).rejects.toThrow();
    expect(dialled).toEqual(["+436601234567"]);
  });
});
