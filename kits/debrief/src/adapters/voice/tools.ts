import { kitAgentTools, type AgentToolDefinition, type KitDefinition, type KitToolExecutor } from "@kitstackco/sdk";
import type { RealtimeFunctionTool } from "@kitstackco/voice";

/** Kit tools available on the primary, after-the-meeting debrief call. */
const DEBRIEF_CALL_TOOLS = ["get_debrief_draft", "update_debrief_draft"] as const;
/** Kit tools available on the optional, before-the-meeting prebrief call. */
const PREBRIEF_CALL_TOOLS = ["save_meeting_plan"] as const;

const DEBRIEF_DESCRIPTIONS: Readonly<Record<string, string>> = {
  get_debrief_draft: "Read the current provisional debrief fields before continuing the call. Never treat an unconfirmed field as a confirmed customer event.",
  update_debrief_draft: "Save one or more facts explicitly stated or agreed during the call into the provisional debrief draft. This does not confirm the debrief or publish memory.",
};

const PREBRIEF_DESCRIPTIONS: Readonly<Record<string, string>> = {
  save_meeting_plan: "Save what the rep wants to achieve in the upcoming sales meeting and any concerns they raised. Never writes debrief draft fields.",
};

export interface DebriefVoiceToolSet {
  readonly realtime: RealtimeFunctionTool[];
  readonly agent: AgentToolDefinition[];
}

/**
 * Voice tools derived from the debrief kit's own tool definitions, split by
 * call purpose: the primary debrief call can read and save draft fields; the
 * optional, earlier prebrief call can only save the rep's meeting plan and
 * never sees or touches the debrief draft. Calls run through KitStack
 * dispatch either way, so validation, authorization and telemetry match MCP.
 * The voice channel adds its own end_call tool to both.
 */
export function createDebriefVoiceTools(
  kit: KitDefinition,
  executor: KitToolExecutor,
): { forPurpose(purpose: string | undefined): DebriefVoiceToolSet } {
  const build = (tools: readonly string[], descriptions: Readonly<Record<string, string>>): DebriefVoiceToolSet => {
    const built = kitAgentTools({
      kit,
      executor,
      tools,
      boundArgs: (session) => ({ session_id: session.id }),
      boundArgNames: ["session_id"],
      principal: () => "voice-agent",
      descriptions,
    });
    return {
      realtime: built.schemas.map((schema) => ({ type: "function" as const, ...schema })),
      agent: built.definitions,
    };
  };
  const debrief = build(DEBRIEF_CALL_TOOLS, DEBRIEF_DESCRIPTIONS);
  const prebrief = build(PREBRIEF_CALL_TOOLS, PREBRIEF_DESCRIPTIONS);
  return { forPurpose: (purpose) => (purpose === "prebrief" ? prebrief : debrief) };
}
