/**
 * Copied from ~/dev/adint src/shared/kernel/scrub-identifiers.ts (the parts the graph needs).
 * Privacy invariant (adint ADR-0009): no consent string / cookie / device id ever leaves the
 * domain. buildAdGraph() runs this over every label + meta value as defense-in-depth before the
 * graph JSON leaves the kit — keep it. See .track/docs/adint-domain-reference.md §7.
 */

// Consent strings (TCF/GPP), privacy signals, and raw device identifiers can appear embedded in
// markup/ad payloads where URL scrubbing never reaches. Redact the value wherever such a key
// appears, keeping the key so surrounding structure survives.
const SENSITIVE_TOKEN =
  /\b(gdpr_consent|addtl_consent|euconsent(?:[_-]?v2)?|gpp_sid|gpp|us_privacy|usprivacy|dc_rdid|rdid|idfa|aaid|advertising_id)\s*=\s*[^;,&"'\s<>)]*/gi;

export function redactSensitiveTokens(text: string): string {
  return text.replace(SENSITIVE_TOKEN, (match) => `${match.slice(0, match.indexOf("=") + 1)}`);
}
