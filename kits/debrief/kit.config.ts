import { defineKit, defineTool, kit } from "@kitstackco/sdk";
import type { KitContext, KitToolResult } from "@kitstackco/sdk";
import { z } from "zod";

/**
 * The canonical kit deliberately contains no debrief implementation or
 * transcript/audio storage. The demo runtime injects these operations at its
 * composition boundary, while the SDK-facing tool contract stays stable.
 */
export interface DebriefToolHandlers {
  prepare_debrief: (input: { goal: string }, ctx: KitContext) => Promise<unknown>;
  get_session: (input: { session_id: string }, ctx: KitContext) => Promise<unknown>;
  get_debrief: (input: { session_id: string }, ctx: KitContext) => Promise<unknown>;
  confirm_debrief: (input: { session_id: string }, ctx: KitContext) => Promise<unknown>;
  teach_from_correction: (
    input: { session_id: string; correction: string },
    ctx: KitContext,
  ) => Promise<unknown>;
}

let injectedHandlers: DebriefToolHandlers | undefined;

/** Install the runtime-owned implementation used by the exported tools. */
export function configureDebriefHandlers(handlers: DebriefToolHandlers): void {
  injectedHandlers = handlers;
}

/** Clear the process-local seam between isolated demo runs or tests. */
export function resetDebriefHandlers(): void {
  injectedHandlers = undefined;
}

function invoke<K extends keyof DebriefToolHandlers>(
  name: K,
  input: Parameters<DebriefToolHandlers[K]>[0],
  ctx: KitContext,
): Promise<KitToolResult> {
  const handler = injectedHandlers?.[name] as
    | ((input: Parameters<DebriefToolHandlers[K]>[0], ctx: KitContext) => Promise<unknown>)
    | undefined;
  if (!handler) {
    return Promise.resolve(
      kit.error(`Debrief handler "${name}" has not been injected by the runtime.`),
    );
  }
  return handler(input, ctx).then((result) => kit.json(result));
}

export const prepareDebrief = defineTool({
  name: "prepare_debrief",
  description: "Prepare a sales debrief session with a goal before the voice call.",
  args: z.object({
    goal: z.string().min(1).describe("The sales outcome or question this debrief should address."),
  }),
  handler: async (_db, args, ctx) => invoke("prepare_debrief", args, ctx),
});

export const getSession = defineTool({
  name: "get_session",
  description: "Retrieve the current state and metadata for a debrief session.",
  args: z.object({
    session_id: z.string().min(1).describe("The identifier of the debrief session to retrieve."),
  }),
  handler: async (_db, args, ctx) => invoke("get_session", args, ctx),
});

export const getDebrief = defineTool({
  name: "get_debrief",
  description: "Retrieve the concise debrief result without conversation content.",
  args: z.object({
    session_id: z.string().min(1).describe("The identifier of the completed or active debrief session."),
  }),
  handler: async (_db, args, ctx) => invoke("get_debrief", args, ctx),
});

export const confirmDebrief = defineTool({
  name: "confirm_debrief",
  description: "Confirm a debrief after reviewing its result and recorded learning.",
  args: z.object({
    session_id: z.string().min(1).describe("The identifier of the debrief session to confirm."),
  }),
  handler: async (_db, args, ctx) => invoke("confirm_debrief", args, ctx),
});

export const teachFromCorrection = defineTool({
  name: "teach_from_correction",
  description: "Record an operator correction as a candidate learning for later approval.",
  args: z.object({
    session_id: z.string().min(1).describe("The identifier of the debrief session being corrected."),
    correction: z.string().min(1).describe("The operator-entered correction to learn from; do not provide a transcript."),
  }),
  handler: async (_db, args, ctx) => invoke("teach_from_correction", args, ctx),
});

export const tools = [
  prepareDebrief,
  getSession,
  getDebrief,
  confirmDebrief,
  teachFromCorrection,
];

export default defineKit({
  id: "debrief",
  version: "0.1.0",
  name: "Sales Debrief",
  description: "A sales voice debrief workflow that records metadata and operator corrections, never transcript or audio content.",
  schema: {},
  migrationSql: "SELECT 1;",
  instructions: "Use the injected debrief runtime. Do not store or request transcript or audio payloads.",
  tools,
});
