import { kitAgentTools, type AgentToolDefinition, type KitDefinition, type KitToolExecutor } from "@kitstackco/sdk";
import type { RealtimeFunctionTool } from "@kitstackco/voice";

/** Kit tools the voice agent may call; the session id is bound from the call. */
const VOICE_KIT_TOOLS = ["get_debrief_draft", "update_debrief_draft"] as const;

const VOICE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  get_debrief_draft: "Read the current provisional debrief fields before continuing the call. Never treat an unconfirmed field as a confirmed customer event.",
  update_debrief_draft: "Save one or more facts explicitly stated or agreed during the call into the provisional debrief draft. This does not confirm the debrief or publish memory.",
};

/**
 * Voice tools derived from the debrief kit's own tool definitions. Calls run
 * through KitStack dispatch, so validation, authorization and telemetry are
 * the same as for MCP. The voice channel adds its own end_call tool.
 */
export function createDebriefVoiceTools(kit: KitDefinition, executor: KitToolExecutor): {
  realtime: RealtimeFunctionTool[];
  agent: AgentToolDefinition[];
} {
  const tools = kitAgentTools({
    kit,
    executor,
    tools: VOICE_KIT_TOOLS,
    boundArgs: (session) => ({ session_id: session.id }),
    boundArgNames: ["session_id"],
    principal: () => "voice-agent",
    descriptions: VOICE_DESCRIPTIONS,
  });
  return {
    realtime: tools.schemas.map((schema) => ({ type: "function" as const, ...schema })),
    agent: tools.definitions,
  };
}
