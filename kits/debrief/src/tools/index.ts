import { defineTool, kit, type KitContext, type KitToolResult } from "@kitstackco/sdk";
import { withToolMetadata } from "@kitstackco/sdk";
import { z } from "zod";
import type { DebriefToolHandler } from "../contracts";

export type DebriefToolName =
  | "prepare_debrief"
  | "prepare_rehearsal"
  | "get_session"
  | "get_debrief"
  | "get_debrief_draft"
  | "get_debrief_for_confirmation"
  | "update_debrief_draft"
  | "confirm_debrief_draft"
  | "confirm_debrief"
  | "teach_from_correction"
  | "approve_memory"
  | "publish_memory"
  | "start_voice_call"
  | "get_voice_status";

const ASSIST_TOOLS: ReadonlySet<DebriefToolName> = new Set([
  "get_session", "get_debrief", "get_debrief_draft", "get_debrief_for_confirmation", "get_voice_status",
]);

export type { DebriefToolHandler } from "../contracts";

const fallback = async (
  _ctx: KitContext,
  _args: Record<string, unknown>,
): Promise<KitToolResult> => kit.error("Debrief service is not bound to this kit runtime");

function tool(
  name: DebriefToolName,
  description: string,
  args: z.ZodType<any>,
  handlers: Partial<Record<DebriefToolName, DebriefToolHandler>>,
) {
  return withToolMetadata(defineTool({
    name,
    description,
    // The repository currently has two installed Zod declaration copies
    // (the SDK package and the kits workspace). Runtime schemas are the same;
    // keep this adapter boundary explicit until workspace dependency hoisting
    // is normalized.
    args: args as any,
    handler: (ctx, parsedArgs) =>
      (handlers[name] ?? fallback)(ctx, parsedArgs as Record<string, unknown>),
  }), ASSIST_TOOLS.has(name) ? "assist" : "act", "sensitive");
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
      "prepare_rehearsal",
      "Prepare a goal-only rehearsal debrief for the voice simulator (no customer, no phone call).",
      z.object({ goal: z.string().min(1).describe("The outcome to rehearse") }),
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
      "get_debrief_draft",
      "Read the provisional debrief fields saved so far, including during a call. Unconfirmed fields are not customer events.",
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
    tool(
      "approve_memory",
      "Approve a candidate memory taught during this debrief.",
      z.object({
        session_id: z.string().min(1).describe("The shared debrief session ID"),
        memory_id: z.string().min(1).describe("The candidate memory to approve"),
      }),
      handlers,
    ),
    tool(
      "publish_memory",
      "Publish an approved memory so a later debrief can retrieve it.",
      z.object({
        session_id: z.string().min(1).describe("The shared debrief session ID"),
        memory_id: z.string().min(1).describe("The approved memory to publish"),
      }),
      handlers,
    ),
    tool(
      "start_voice_call",
      "Start the deterministic simulator voice call for a prepared debrief (rehearsal; no phone call).",
      z.object({ session_id: z.string().min(1).describe("The shared debrief session ID") }),
      handlers,
    ),
    tool(
      "get_voice_status",
      "Poll the simulator voice call until it reaches confirmation.",
      z.object({ session_id: z.string().min(1).describe("The shared debrief session ID") }),
      handlers,
    ),
  ];
}
