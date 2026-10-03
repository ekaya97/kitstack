import { kitAgentTools, type AgentToolDefinition, type KitDefinition, type KitToolExecutor } from "@kitstackco/sdk";

export interface RealtimeFunctionTool {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface DebriefVoiceTools {
  /** Function schemas sent to the realtime model. */
  readonly realtime: readonly RealtimeFunctionTool[];
  /** defineAgent tools; `hangup` ends the call after the agent's goodbye. */
  agent(hangup: () => void): AgentToolDefinition[];
}

/** Kit tools the voice agent may call; the session id is bound from the call. */
const VOICE_KIT_TOOLS = ["get_debrief_draft", "update_debrief_draft"] as const;

const VOICE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  get_debrief_draft: "Read the current provisional debrief fields before continuing the call. Never treat an unconfirmed field as a confirmed customer event.",
  update_debrief_draft: "Save one or more facts explicitly stated or agreed during the call into the provisional debrief draft. This does not confirm the debrief or publish memory.",
};

const END_CALL: RealtimeFunctionTool = {
  type: "function",
  name: "end_call",
  description: "End the phone call. Use it only after the debrief is complete: you have saved the agreed facts, briefly summarised them, and said goodbye. The line drops after your next sentence finishes playing.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
};

/**
 * Voice tools derived from the debrief kit's own tool definitions. Calls run
 * through KitStack dispatch, so validation, authorization and telemetry are
 * the same as for MCP; only `end_call` is a channel (call-control) tool.
 */
export function createDebriefVoiceTools(kit: KitDefinition, executor: KitToolExecutor): DebriefVoiceTools {
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
    realtime: [...tools.schemas.map((schema) => ({ type: "function" as const, ...schema })), END_CALL],
    agent: (hangup) => [...tools.definitions, createEndCallTool(hangup)],
  };
}

/** Lets the agent end the call; the transport decides when the line actually drops. */
export function createEndCallTool(hangup: () => void): AgentToolDefinition {
  return {
    name: "end_call",
    description: "End the phone call after the debrief is complete and the caller has been told goodbye.",
    execute: async () => {
      hangup();
      return { status: "ending", instruction: "Say one short goodbye sentence if you have not already. Do not ask further questions." };
    },
  };
}
