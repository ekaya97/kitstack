/**
 * Tenancy rules shared by the MCP router and the debrief service.
 *
 * Every signed-in user works in a personal organization, `org-user-<userId>`,
 * so customers, debriefs, memories and telemetry never mix between people.
 * Operators keep working in the configured operator organization (`org-demo`
 * by default); the router decides who is an operator from an authz grant and
 * the service only accepts that organization for allowlisted subjects.
 *
 * This module has no runtime dependencies so the router can import it.
 */

/** Prefix of every personal organization id. */
export const PERSONAL_ORG_PREFIX = "org-user-";

/** Principal used by the voice agent's own kit tool calls (never an MCP user). */
export const VOICE_AGENT_PRINCIPAL = "voice-agent";

/** The personal organization for one user. */
export function personalOrgId(userId: string): string {
  const id = userId.trim();
  if (!id) throw new Error("A user id is required for a personal organization");
  return `${PERSONAL_ORG_PREFIX}${id}`;
}
