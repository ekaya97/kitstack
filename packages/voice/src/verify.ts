/**
 * Twilio Verify client for self-service phone verification. Preferred over a
 * plain SMS send: German Twilio numbers often cannot send SMS directly, and
 * Verify adds fraud protection (rate limiting, carrier checks) that a raw
 * Messages API call does not.
 *
 * Twilio Verify owns the one-time code; this client never sees or stores it
 * beyond the single `check` request/response pair.
 */

export interface TwilioVerifyStartResult {
  status: string;
  sid?: string;
}

export interface TwilioVerifyCheckResult {
  status: string;
  approved: boolean;
}

export interface TwilioVerifyClient {
  /** Start a verification: sends an SMS code to `to` (E.164). */
  start(to: string): Promise<TwilioVerifyStartResult>;
  /** Check a code the caller provided against the open verification for `to`. */
  check(to: string, code: string): Promise<TwilioVerifyCheckResult>;
}

export interface TwilioVerifyClientOptions {
  accountSid: string;
  authToken: string;
  /** The Twilio Verify Service SID (starts with "VA"). */
  serviceSid: string;
  apiBaseUrl?: string;
  /** Test seam for the Twilio Verify REST API. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Server-side Twilio Verify REST client. Credentials never enter telemetry
 * or a browser-facing response; the auth token stays in closure scope.
 */
export function createTwilioVerifyClient(options: TwilioVerifyClientOptions): TwilioVerifyClient {
  const accountSid = required(options.accountSid, "Twilio account SID");
  const authToken = required(options.authToken, "Twilio auth token");
  const serviceSid = required(options.serviceSid, "Twilio Verify service SID");
  const apiBaseUrl = (options.apiBaseUrl ?? "https://verify.twilio.com").replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("A fetch implementation is required for Twilio Verify");
  const authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  return {
    async start(to) {
      const endpoint = `${apiBaseUrl}/v2/Services/${encodeURIComponent(serviceSid)}/Verifications`;
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { authorization, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, Channel: "sms" }),
      });
      if (!response.ok) throw new Error(`Twilio Verify start returned HTTP ${response.status}`);
      const payload = await response.json() as { status?: unknown; sid?: unknown };
      return {
        status: typeof payload.status === "string" ? payload.status : "pending",
        ...(typeof payload.sid === "string" ? { sid: payload.sid } : {}),
      };
    },
    async check(to, code) {
      const endpoint = `${apiBaseUrl}/v2/Services/${encodeURIComponent(serviceSid)}/VerificationCheck`;
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { authorization, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, Code: code }),
      });
      if (!response.ok) throw new Error(`Twilio Verify check returned HTTP ${response.status}`);
      const payload = await response.json() as { status?: unknown };
      const status = typeof payload.status === "string" ? payload.status : "pending";
      return { status, approved: status === "approved" };
    },
  };
}

function required(value: string, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value;
}
