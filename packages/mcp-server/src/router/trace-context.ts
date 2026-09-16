import { randomBytes } from "node:crypto";

/** The W3C trace context fields needed by KitStack's request boundary. */
export interface TraceparentContext {
  /** The 32 lower-case hexadecimal W3C trace ID. */
  traceId: string;
  /** The 16 lower-case hexadecimal parent span ID, when supplied. */
  parentId?: string;
  /** The validated, normalized traceparent value to propagate downstream. */
  traceparent: string;
}

/**
 * Parse a W3C `traceparent` header without throwing on attacker-controlled
 * input. Invalid values are rejected as a unit; callers can then start a new
 * trace rather than trusting a partial ID.
 *
 * Version 00 is the only version whose wire shape is currently defined. For
 * future versions, the optional suffix is preserved after validating that it
 * is lower-case hexadecimal. The all-zero trace and parent IDs are forbidden
 * by the W3C specification.
 */
export function parseTraceparent(value: unknown): TraceparentContext | null {
  if (typeof value !== "string") return null;

  const input = value.trim();
  if (input.length === 0 || input.length > 512) return null;

  const parts = input.split("-");
  if (parts.length < 4) return null;

  const [version, traceId, parentId, flags, ...extra] = parts;
  if (!/^[0-9a-f]{2}$/.test(version) || version === "ff") return null;
  if (!/^[0-9a-f]{32}$/.test(traceId) || isZero(traceId)) return null;
  if (!/^[0-9a-f]{16}$/.test(parentId) || isZero(parentId)) return null;
  if (!/^[0-9a-f]{2}$/.test(flags)) return null;

  // Version 00 must have exactly the four required fields. Future versions
  // may append version-specific fields, but never an empty/invalid suffix.
  if (version === "00" && extra.length > 0) return null;
  if (extra.some((field) => !/^[0-9a-f]+$/.test(field))) return null;

  return {
    traceId,
    parentId,
    traceparent: input,
  };
}

/**
 * Resolve an inbound request's trace context. A malformed/missing header is
 * treated as an untrusted value and replaced with a fresh valid root context.
 * A valid legacy `x-trace-id` is retained only as a compatibility fallback.
 */
export function resolveTraceparent(
  inboundTraceparent?: unknown,
  legacyTraceId?: unknown,
): TraceparentContext {
  const parsed = parseTraceparent(inboundTraceparent);
  if (parsed) return parsed;

  const traceId = validTraceId(legacyTraceId) ?? randomHex(16);
  const parentId = randomHex(8);
  return {
    traceId,
    parentId,
    traceparent: `00-${traceId}-${parentId}-01`,
  };
}

/** Build a valid traceparent when a caller supplies already validated IDs. */
export function traceparentFromIds(traceId?: unknown, parentId?: unknown): string | null {
  const validTrace = validTraceId(traceId);
  const validParent = validParentId(parentId);
  if (!validTrace || !validParent) return null;
  return `00-${validTrace}-${validParent}-01`;
}

function validTraceId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value) && !isZero(value)
    ? value
    : null;
}

function validParentId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{16}$/.test(value) && !isZero(value)
    ? value
    : null;
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function isZero(value: string): boolean {
  return /^0+$/.test(value);
}
