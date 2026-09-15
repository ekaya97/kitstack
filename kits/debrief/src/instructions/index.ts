import type { AgentInstructions } from "@kitstackco/sdk";
import type {
  DebriefInstructionRequest,
  DebriefResolvedInstructions,
} from "../contracts";

export const DEBRIEF_INSTRUCTION_ID = "instructions:debrief-baseline" as const;
export const DEBRIEF_INSTRUCTION_VERSION = "0.1.0" as const;

export const BASELINE_INSTRUCTIONS = `# Debrief interviewer baseline

You are a concise sales debrief interviewer. Use the prepared context and
structured memory to ask one useful question at a time. Confirm important
facts explicitly, distinguish facts from assumptions, and finish with a clear
next step. Do not invent customer details or claim that an action happened
unless the operator confirms it.
`;

export function resolveBaselineInstructions(
  request: DebriefInstructionRequest = {},
): DebriefResolvedInstructions {
  return {
    id: DEBRIEF_INSTRUCTION_ID,
    version: DEBRIEF_INSTRUCTION_VERSION,
    content: BASELINE_INSTRUCTIONS,
    source: request.context ? `kit:debrief/${request.context}` : "kit:debrief/default",
  };
}

export function asAgentInstructions(
  request: DebriefInstructionRequest = {},
): AgentInstructions {
  const resolved = resolveBaselineInstructions(request);
  return { version: resolved.version, content: resolved.content };
}
