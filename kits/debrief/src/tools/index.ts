import { defineTool, kit, type KitContext, type KitToolResult } from "@kitstackco/sdk";
import { z } from "zod";
import type {
  DebriefDraftUpdate,
  DebriefOperations,
  DebriefToolHandler,
  PrepareDebriefInput,
} from "../contracts";

export type DebriefToolName =
  | "prepare_debrief"
  | "get_session"
  | "get_debrief"
  | "get_debrief_for_confirmation"
  | "update_debrief_draft"
  | "confirm_debrief_draft"
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
      z.object({
        goal: z.string().min(1).describe("The outcome to achieve in the sales debrief"),
        company: z.string().min(1).describe("The customer company"),
        contact_name: z.string().min(1).describe("The customer contact name"),
        location: z.string().min(1).describe("Where the call or meeting takes place"),
        callback_at: z.string().min(1).describe("When the phone should ring: ISO timestamp or HH:mm"),
        callback_timezone: z.string().min(1).describe("IANA timezone for callback_at, for example Europe/Berlin"),
        buffer_minutes: z.number().int().min(0).max(1440).optional().default(0).describe("Optional scheduling buffer after callback_at"),
      }),
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
      "get_debrief_for_confirmation",
      "Load the editable structured debrief draft and the confirmation View.",
      z.object({ session_id: z.string().min(1).describe("The shared debrief session ID") }),
      handlers,
    ),
    tool(
      "update_debrief_draft",
      "Edit structured debrief fields before confirmation; this never writes an immutable event.",
      z.object({
        session_id: z.string().min(1).describe("The shared debrief session ID"),
        outcome: z.string().optional().describe("The agreed outcome"),
        next_step: z.string().optional().describe("The next sales action"),
        customer_update: z.string().optional().describe("What changed for the customer"),
        discovered_address: z.string().optional().describe("A new customer address learned on the call"),
        follow_up_date: z.string().optional().describe("The requested follow-up date"),
      }),
      handlers,
    ),
    tool(
      "confirm_debrief_draft",
      "Confirm the editable debrief draft and persist its immutable customer events.",
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
      await operations.prepareDebrief({
        goal: String(args.goal),
        company: String(args.company),
        contact_name: String(args.contact_name),
        location: String(args.location),
        callback_at: String(args.callback_at),
        callback_timezone: String(args.callback_timezone),
        buffer_minutes: typeof args.buffer_minutes === "number" ? args.buffer_minutes : 0,
      } satisfies PrepareDebriefInput, ctx),
    ),
    get_session: async (_db, args, ctx) => kit.json(
      await operations.getSession(String(args.session_id), ctx),
    ),
    get_debrief: async (_db, args, ctx) => kit.json(
      await operations.getDebrief(String(args.session_id), ctx),
    ),
    get_debrief_for_confirmation: async (_db, args, ctx) => kit.json(
      await operations.getDebriefForConfirmation(String(args.session_id), ctx),
    ),
    update_debrief_draft: async (_db, args, ctx) => kit.json(
      await operations.updateDebriefDraft(
        String(args.session_id),
        pickDraftUpdate(args),
        ctx,
      ),
    ),
    confirm_debrief_draft: async (_db, args, ctx) => kit.json(
      await operations.confirmDebriefDraft(String(args.session_id), ctx),
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

function pickDraftUpdate(args: Record<string, unknown>): DebriefDraftUpdate {
  const fields = ["outcome", "next_step", "customer_update", "discovered_address", "follow_up_date"] as const;
  return Object.fromEntries(
    fields.flatMap((field) => typeof args[field] === "string" ? [[field, args[field]]] : []),
  ) as DebriefDraftUpdate;
}
