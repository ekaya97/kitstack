import { defineKit, defineTool, kit, type KitContext, type KitToolResult } from "@kitstackco/sdk";
import { z } from "zod";

/**
 * The SDK kit is intentionally transport-neutral. The demo runtime binds
 * these handlers to the specialized DebriefService; the fallback makes an
 * unbound kit fail visibly instead of pretending to complete a call.
 */
export type DebriefToolName =
  | "prepare_debrief"
  | "get_session"
  | "get_debrief"
  | "confirm_debrief"
  | "teach_from_correction";

export type DebriefToolHandler = (
  db: unknown,
  args: Record<string, unknown>,
  ctx: KitContext,
) => Promise<KitToolResult>;

const fallback = async (
  _db: unknown,
  _args: Record<string, unknown>,
  _ctx: KitContext,
): Promise<KitToolResult> => kit.error("Debrief service is not bound to this kit runtime");

function tool(
  name: DebriefToolName,
  description: string,
  args: z.ZodType,
  handlers: Partial<Record<DebriefToolName, DebriefToolHandler>>,
) {
  return defineTool({
    name,
    description,
    args,
    handler: handlers[name] ?? fallback,
  });
}

export function createDebriefKit(
  handlers: Partial<Record<DebriefToolName, DebriefToolHandler>> = {},
) {
  const tools = [
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

  return defineKit({
    id: "debrief",
    version: "0.1.0",
    name: "Sales Debrief",
    description: "Prepare, conduct, confirm, and teach a short sales voice debrief.",
    schema: {},
    migrationSql: "SELECT 1;",
    instructions: "Use the injected demo debrief service; never retain call transcripts or audio.",
    triggers: ["sales", "debrief", "voice", "customer", "follow-up"],
    tools,
  });
}

const defaultKit = createDebriefKit();
export const tools = defaultKit.tools;
export default defaultKit;
