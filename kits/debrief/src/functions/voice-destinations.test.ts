import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { LibsqlVoiceDestinationStore, VoiceDestinationService, maskPhone, normalizePhone } from "./voice-destinations.js";
import type { TwilioVerifyClient } from "@kitstackco/voice";

const clients: Client[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

function database(): Client {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  return client;
}

const FAKE_CODE = "998877";

function fakeVerify(): TwilioVerifyClient & { codes: Map<string, string> } {
  const codes = new Map<string, string>();
  return {
    codes,
    start: vi.fn(async (to: string) => { codes.set(to, FAKE_CODE); return { status: "pending", sid: "VE1" }; }),
    check: vi.fn(async (to: string, code: string) => ({ status: codes.get(to) === code ? "approved" : "pending", approved: codes.get(to) === code })),
  };
}

class FakeClock {
  private current: Date;
  constructor(value: string) { this.current = new Date(value); }
  now = (): string => this.current.toISOString();
  advance(ms: number): void { this.current = new Date(this.current.getTime() + ms); }
}

describe("normalizePhone / maskPhone", () => {
  it("accepts allowed countries and rejects everything else", () => {
    expect(normalizePhone("+491701234567")).toBe("+491701234567");
    expect(normalizePhone("+436641234567")).toBe("+436641234567");
    expect(normalizePhone("+41791234567")).toBe("+41791234567");
    expect(() => normalizePhone("+12025550123")).toThrow("allowed country");
    expect(() => normalizePhone("0491701234567")).toThrow("E.164");
  });

  it("masks the middle of a number, keeping the first three and last two digits", () => {
    expect(maskPhone("+491701234567")).toBe("+49********67");
  });
});

describe("VoiceDestinationService", () => {
  it("fails register/verify with a clear error when Twilio Verify is not configured", async () => {
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database()) });
    await expect(service.register("org-1", "user-1", "+491701234567")).rejects.toThrow("TWILIO_VERIFY_SERVICE_SID");
    await expect(service.verifyCode("org-1", "user-1", "+491701234567", FAKE_CODE)).rejects.toThrow("TWILIO_VERIFY_SERVICE_SID");
  });

  it("registers, verifies, and reports a masked verified number", async () => {
    const clock = new FakeClock("2026-10-01T10:00:00.000Z");
    const verify = fakeVerify();
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database()), verify, now: clock.now });

    await expect(service.status("org-1", "user-1")).resolves.toEqual({ registered: false, verified: false });
    await service.register("org-1", "user-1", "+491701234567");
    expect(verify.start).toHaveBeenCalledWith("+491701234567");
    await expect(service.hasVerifiedNumber("org-1", "user-1")).resolves.toBe(false);

    await service.verifyCode("org-1", "user-1", "+491701234567", FAKE_CODE);
    await expect(service.hasVerifiedNumber("org-1", "user-1")).resolves.toBe(true);
    await expect(service.getVerifiedNumber("org-1", "user-1")).resolves.toBe("+491701234567");
    await expect(service.status("org-1", "user-1")).resolves.toEqual({ registered: true, verified: true, maskedNumber: "+49********67" });
  });

  it("rejects a wrong code without marking the number verified", async () => {
    const verify = fakeVerify();
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database()), verify });
    await service.register("org-1", "user-1", "+491701234567");
    await expect(service.verifyCode("org-1", "user-1", "+491701234567", "000000")).rejects.toThrow("invalid or has expired");
    await expect(service.hasVerifiedNumber("org-1", "user-1")).resolves.toBe(false);
  });

  it("refuses to verify a number that was never registered", async () => {
    const verify = fakeVerify();
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database()), verify });
    await expect(service.verifyCode("org-1", "user-1", "+491701234567", FAKE_CODE)).rejects.toThrow("register_phone first");
  });

  it("rate-limits verification starts to 3 per hour and resets after the window", async () => {
    const clock = new FakeClock("2026-10-01T10:00:00.000Z");
    const verify = fakeVerify();
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database()), verify, now: clock.now });
    await service.register("org-1", "user-1", "+491701234567");
    await service.register("org-1", "user-1", "+491701234567");
    await service.register("org-1", "user-1", "+491701234567");
    await expect(service.register("org-1", "user-1", "+491701234567")).rejects.toThrow("Too many phone verification attempts");
    expect(verify.start).toHaveBeenCalledTimes(3);

    clock.advance(61 * 60 * 1000);
    await expect(service.register("org-1", "user-1", "+491701234567")).resolves.toEqual({ status: "sent" });
    expect(verify.start).toHaveBeenCalledTimes(4);
  });

  it("keeps rate-limit counters and numbers scoped per org and per user", async () => {
    const verify = fakeVerify();
    const store = new LibsqlVoiceDestinationStore(database());
    const service = new VoiceDestinationService({ store, verify });
    await service.register("org-1", "user-1", "+491701234567");
    await service.register("org-1", "user-1", "+491701234567");
    await service.register("org-1", "user-1", "+491701234567");
    await expect(service.register("org-1", "user-2", "+491701234568")).resolves.toEqual({ status: "sent" });
    await expect(service.register("org-2", "user-1", "+491701234569")).resolves.toEqual({ status: "sent" });
  });

  it("removes a registered number", async () => {
    const verify = fakeVerify();
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database()), verify });
    await service.register("org-1", "user-1", "+491701234567");
    await service.verifyCode("org-1", "user-1", "+491701234567", FAKE_CODE);
    await service.remove("org-1", "user-1");
    await expect(service.status("org-1", "user-1")).resolves.toEqual({ registered: false, verified: false });
    await expect(service.hasVerifiedNumber("org-1", "user-1")).resolves.toBe(false);
  });

  it("never stores the raw verification code", async () => {
    const database_ = database();
    const verify = fakeVerify();
    const service = new VoiceDestinationService({ store: new LibsqlVoiceDestinationStore(database_), verify });
    await service.register("org-1", "user-1", "+491701234567");
    await service.verifyCode("org-1", "user-1", "+491701234567", FAKE_CODE);
    const rows = (await database_.execute("SELECT * FROM voice_destinations")).rows;
    expect(JSON.stringify(rows)).not.toContain(FAKE_CODE);
  });
});
