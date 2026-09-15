import { defineTool, kit, type KitContext, type KitToolResult } from "@kitstackco/sdk";
import { z } from "zod";
import type { DebriefOperations, DebriefToolHandler } from "../contracts";

export type DebriefToolName =
  | "prepare_debrief"
  | "get_session"
  | "get_debrief"
  | "confirm_debrief"
  | "teach_from_correction";

export type { DebriefToolHandler } from "../contracts";

const fallback = async (
  _db: unknown,
  _args: Record<string, unknown>,
  _ctx: KitContext,
): Promise<KitToolResult> => kit.error("Debrief service is not bound to this kit runtime");

function tool(
  name: DebriefToolName,
  description: string,
  args: z.ZodType<any>,
  handlers: Partial<Record<DebriefToolName, DebriefToolHandler>>,
) {
  return defineTool({
    name,
    description,
    // The repository currently has two installed Zod declaration copies
    // (the SDK package and the kits workspace). Runtime schemas are the same;
    // keep this adapter boundary explicit until workspace dependency hoisting
    // is normalized.
    args: args as any,
    handler: (db, parsedArgs, ctx) =>
      (handlers[name] ?? fallback)(db, parsedArgs as Record<string, unknown>, ctx),
  });
}

/** Create the stable MCP-facing tool definitions for the debrief kit. */
export function createDebriefTools(
  handlers: Partial<Record<DebriefToolName, DebriefToolHandler>> = {},
) {
  return [
    tool(
      "prepare_debrief",
      "Prepare a sales debrief session and earmark the outbound voice call.",
      z.object({ goal: z.string().min(1).describe("The outcome to achieve in the sales debrief") }),
      handlers,
    ),
    tool(
      "get_session",
      "Read the current state and identity of one sales debrief session.",
      z.object({ session_id: z.string().min(1).describe("The shared debrief session ID") }),
      handlers,
    ),
    tool(
      "get_debrief",
      "Read the structured result of a completed or partial sales debrief.",
      z.object({ session_id: z.string().min(1).describe("The shared debrief session ID") }),
      handlers,
    ),
    tool(
      "confirm_debrief",
      "Confirm a read-back or mark the debrief partial when details remain uncertain.",
      z.object({
        session_id: z.string().min(1).describe("The shared debrief session ID"),
        outcome: z.enum(["confirmed", "partial"]).describe("Whether the read-back is complete"),
      }),
      handlers,
    ),
    tool(
      "teach_from_correction",
      "Record an operator-entered correction as structured feedback for the next run.",
      z.object({
        session_id: z.string().min(1).describe("The shared debrief session ID"),
        correction: z.string().min(1).describe("The operator-entered correction, not a transcript"),
      }),
      handlers,
    ),
  ];
}

/**
 * Adapt a host service backed by plugins to the SDK tool handler contract.
 * The host owns the service implementation; this adapter stays kit-facing.
 */
export function createDebriefToolHandlers(
  operations: DebriefOperations,
): Record<DebriefToolName, DebriefToolHandler> {
  return {
    prepare_debrief: async (_db, args, ctx) => kit.json(
      await operations.prepareDebrief(String(args.goal), ctx),
    ),
    get_session: async (_db, args, ctx) => kit.json(
      await operations.getSession(String(args.session_id), ctx),
    ),
    get_debrief: async (_db, args, ctx) => kit.json(
      await operations.getDebrief(String(args.session_id), ctx),
    ),
    confirm_debrief: async (_db, args, ctx) => kit.json(
      await operations.confirmDebrief(
        String(args.session_id),
        args.outcome === "partial" ? "partial" : "confirmed",
        ctx,
      ),
    ),
    teach_from_correction: async (_db, args, ctx) => kit.json(
      await operations.teachFromCorrection(
        String(args.session_id),
        String(args.correction),
        ctx,
      ),
    ),
  };
}
