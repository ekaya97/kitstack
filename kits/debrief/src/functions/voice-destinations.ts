import type { Client } from "@libsql/client";
import type { TwilioVerifyClient } from "@kitstackco/voice";

/**
 * Self-service callback numbers for the sales voice agent, verified through
 * Twilio Verify (never a raw SMS send: German Twilio numbers often cannot
 * send SMS, and Verify adds fraud protection). One number per (org, user).
 * Twilio Verify owns the one-time code; nothing here ever stores it.
 */

/** Countries the self-service callback number may belong to: DE, AT, CH. */
export const ALLOWED_PHONE_COUNTRY_CODES = ["+49", "+43", "+41"] as const;

const E164 = /^\+[1-9]\d{7,14}$/;
const START_RATE_LIMIT = 3;
const START_RATE_WINDOW_MS = 60 * 60 * 1000;

export interface VoiceDestinationStatus {
  registered: boolean;
  verified: boolean;
  maskedNumber?: string;
}

export interface VoiceDestinationRow {
  orgId: string;
  userId: string;
  e164: string;
  verifiedAt: string | null;
  startCount: number;
  startWindowAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = Record<string, unknown>;

const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS voice_destinations (
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    e164 TEXT NOT NULL,
    verified_at TEXT,
    start_count INTEGER NOT NULL DEFAULT 0,
    start_window_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (org_id, user_id)
  );
`;

/** Durable one-number-per-user store. Verification attempt counters live on the same row. */
export class LibsqlVoiceDestinationStore {
  private readonly initialized: Promise<void>;

  constructor(private readonly client: Client) {
    this.initialized = client.executeMultiple(CREATE_SCHEMA_SQL).then(() => undefined);
  }

  async get(orgId: string, userId: string): Promise<VoiceDestinationRow | null> {
    await this.initialized;
    const result = await this.client.execute({
      sql: "SELECT * FROM voice_destinations WHERE org_id = ? AND user_id = ? LIMIT 1",
      args: [orgId, userId],
    });
    return result.rows.length ? mapRow(result.rows[0] as Row) : null;
  }

  /** Record a new verification start attempt; clears any previous verified_at for the new candidate number. */
  async upsertStart(input: { orgId: string; userId: string; e164: string; startCount: number; startWindowAt: string; now: string }): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: `INSERT INTO voice_destinations (org_id, user_id, e164, verified_at, start_count, start_window_at, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
        ON CONFLICT(org_id, user_id) DO UPDATE SET
          e164 = excluded.e164,
          verified_at = NULL,
          start_count = excluded.start_count,
          start_window_at = excluded.start_window_at,
          updated_at = excluded.updated_at`,
      args: [input.orgId, input.userId, input.e164, input.startCount, input.startWindowAt, input.now, input.now],
    });
  }

  async markVerified(orgId: string, userId: string, now: string): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: "UPDATE voice_destinations SET verified_at = ?, updated_at = ? WHERE org_id = ? AND user_id = ?",
      args: [now, now, orgId, userId],
    });
  }

  async remove(orgId: string, userId: string): Promise<void> {
    await this.initialized;
    await this.client.execute({ sql: "DELETE FROM voice_destinations WHERE org_id = ? AND user_id = ?", args: [orgId, userId] });
  }
}

export interface VoiceDestinationServiceOptions {
  store: LibsqlVoiceDestinationStore;
  /** Undefined disables the feature with a clear error (TWILIO_VERIFY_SERVICE_SID not set). */
  verify?: TwilioVerifyClient;
  now?: () => string;
}

/** Self-service register/verify/get/remove logic shared by the debrief tools and the phone directory. */
export class VoiceDestinationService {
  private readonly now: () => string;

  constructor(private readonly options: VoiceDestinationServiceOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async hasVerifiedNumber(orgId: string, userId: string): Promise<boolean> {
    const row = await this.options.store.get(orgId, userId);
    return Boolean(row?.verifiedAt);
  }

  /** The verified number for dialing only; never surfaced in a tool result. */
  async getVerifiedNumber(orgId: string, userId: string): Promise<string | null> {
    const row = await this.options.store.get(orgId, userId);
    return row?.verifiedAt ? row.e164 : null;
  }

  async register(orgId: string, userId: string, phone: string): Promise<{ status: "sent" }> {
    const verify = this.requireVerify();
    const e164 = normalizePhone(phone);
    const row = await this.options.store.get(orgId, userId);
    const now = this.now();
    const withinWindow = Boolean(row?.startWindowAt) && Date.parse(row!.startWindowAt!) + START_RATE_WINDOW_MS > Date.parse(now);
    const startWindowAt = withinWindow ? row!.startWindowAt! : now;
    const startCount = withinWindow ? row!.startCount : 0;
    if (startCount >= START_RATE_LIMIT) {
      throw new Error("Too many phone verification attempts. Try again in about an hour.");
    }
    await verify.start(e164);
    await this.options.store.upsertStart({ orgId, userId, e164, startCount: startCount + 1, startWindowAt, now });
    return { status: "sent" };
  }

  async verifyCode(orgId: string, userId: string, phone: string, code: string): Promise<{ status: "verified" }> {
    const verify = this.requireVerify();
    const e164 = normalizePhone(phone);
    const row = await this.options.store.get(orgId, userId);
    if (!row || row.e164 !== e164) {
      throw new Error("No pending verification for this number. Call register_phone first.");
    }
    const result = await verify.check(e164, code);
    if (!result.approved) throw new Error("That code is invalid or has expired.");
    await this.options.store.markVerified(orgId, userId, this.now());
    return { status: "verified" };
  }

  async status(orgId: string, userId: string): Promise<VoiceDestinationStatus> {
    const row = await this.options.store.get(orgId, userId);
    if (!row) return { registered: false, verified: false };
    return { registered: true, verified: Boolean(row.verifiedAt), maskedNumber: maskPhone(row.e164) };
  }

  async remove(orgId: string, userId: string): Promise<void> {
    await this.options.store.remove(orgId, userId);
  }

  private requireVerify(): TwilioVerifyClient {
    if (!this.options.verify) {
      throw new Error("Phone verification is not configured. Set TWILIO_VERIFY_SERVICE_SID to enable self-service phone numbers.");
    }
    return this.options.verify;
  }
}

/** Validates E.164 format and the DE/AT/CH allowlist; throws a clear message otherwise. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!E164.test(trimmed)) throw new Error("Phone number must be in E.164 format, for example +491701234567.");
  if (!ALLOWED_PHONE_COUNTRY_CODES.some((code) => trimmed.startsWith(code))) {
    throw new Error(`Phone number must be from an allowed country (${ALLOWED_PHONE_COUNTRY_CODES.join(", ")}).`);
  }
  return trimmed;
}

/** Keeps the first three and last two digits; masks the rest. */
export function maskPhone(e164: string): string {
  if (e164.length <= 6) return e164;
  const visibleStart = e164.slice(0, 3);
  const visibleEnd = e164.slice(-2);
  return `${visibleStart}${"*".repeat(e164.length - visibleStart.length - visibleEnd.length)}${visibleEnd}`;
}

function mapRow(row: Row): VoiceDestinationRow {
  return {
    orgId: String(row.org_id),
    userId: String(row.user_id),
    e164: String(row.e164),
    verifiedAt: row.verified_at === null || row.verified_at === undefined ? null : String(row.verified_at),
    startCount: Number(row.start_count),
    startWindowAt: row.start_window_at === null || row.start_window_at === undefined ? null : String(row.start_window_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
