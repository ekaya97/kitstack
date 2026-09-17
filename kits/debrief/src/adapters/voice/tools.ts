import type { AgentToolDefinition } from "@kitstackco/sdk";
import type { DebriefService } from "../../functions/index.js";
import type { DebriefDraftUpdate } from "../../confirmation-contracts.js";

export interface RealtimeFunctionTool {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface DebriefVoiceTools {
  readonly agent: readonly AgentToolDefinition[];
  readonly realtime: readonly RealtimeFunctionTool[];
}

const DRAFT_FIELDS = [
  "outcome",
  "next_step",
  "customer_update",
  "discovered_address",
  "follow_up_date",
] as const;

const DRAFT_FIELD_DESCRIPTIONS: Record<typeof DRAFT_FIELDS[number], string> = {
  outcome: "The outcome explicitly stated or agreed during the call.",
  next_step: "The next action explicitly agreed during the call.",
  customer_update: "A material update about the customer explicitly learned during the call.",
  discovered_address: "A new customer address explicitly provided during the call.",
  follow_up_date: "The follow-up date explicitly agreed during the call.",
};

const DRAFT_PARAMETERS = {
  type: "object",
  properties: Object.fromEntries(DRAFT_FIELDS.map((field) => [field, {
    type: "string",
    description: DRAFT_FIELD_DESCRIPTIONS[field],
  }])),
  additionalProperties: false,
  minProperties: 1,
} as const;

export const DEBRIEF_VOICE_REALTIME_TOOLS: readonly RealtimeFunctionTool[] = [
  {
    type: "function",
    name: "get_debrief_draft",
    description: "Read the current provisional debrief fields before continuing the call. Never treat an unconfirmed field as a confirmed customer event.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "update_debrief_draft",
    description: "Save one or more facts explicitly stated or agreed during the call into the provisional debrief draft. This does not confirm the debrief or publish memory.",
    parameters: DRAFT_PARAMETERS,
  },
];

/** Bind debrief persistence to the provider-neutral defineAgent tool contract. */
export function createDebriefVoiceTools(debrief: Pick<DebriefService, "getDraft" | "updateDebriefDraft">): DebriefVoiceTools {
  return {
    realtime: DEBRIEF_VOICE_REALTIME_TOOLS,
    agent: [
      {
        name: "get_debrief_draft",
        description: "Read the current provisional debrief fields before continuing the call.",
        execute: async (_args, session) => {
          const draft = await debrief.getDraft(session.id);
          return {
            fields: draft?.fields ?? {},
          };
        },
      },
      {
        name: "update_debrief_draft",
        description: "Save explicitly stated or agreed call facts into the provisional debrief draft without confirming it.",
        execute: async (args, session) => {
          const update = parseDraftUpdate(args);
          const confirmation = await debrief.updateDebriefDraft(session.id, update);
          return {
            state: confirmation.state,
            fields: confirmation.draft.fields,
            confirmation_required: true,
          };
        },
      },
    ],
  };
}

function parseDraftUpdate(args: unknown): DebriefDraftUpdate {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("update_debrief_draft arguments must be an object");
  }
  const update = Object.fromEntries(
    DRAFT_FIELDS.flatMap((field) => {
      const value = (args as Record<string, unknown>)[field];
      return typeof value === "string" && value.trim() ? [[field, value.trim()]] : [];
    }),
  ) as DebriefDraftUpdate;
  if (Object.keys(update).length === 0) throw new Error("update_debrief_draft requires at least one non-empty field");
  return update;
}
