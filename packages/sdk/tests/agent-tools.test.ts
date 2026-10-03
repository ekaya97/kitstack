import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineKit } from "../src/define-kit";
import { defineTool } from "../src/define-tool";
import { kit } from "../src/result";
import { kitAgentTools, toolFunctionSchema } from "../src/agent-tools";
import { createKitServer } from "../src/server/index";

const saveNote = defineTool({
  name: "save_note",
  description: "Save a note for a session",
  mode: "act",
  classification: "sensitive",
  args: z.object({
    session_id: z.string().describe("Session"),
    note: z.string().min(1).describe("The note"),
    pinned: z.boolean().optional(),
  }),
  handler: async (_ctx, args) => kit.json({ saved: args.note, session: args.session_id }),
});

const notesKit = defineKit({
  id: "notes", version: "0.1.0", name: "Notes", description: "Notes", schema: {},
  migrationSql: "SELECT 1;", instructions: "", tools: [saveNote],
});

describe("kit tools for agents", () => {
  it("records read/act metadata on the tool", () => {
    expect(saveNote.mode).toBe("act");
    expect(saveNote.annotations).toEqual({ readOnlyHint: false, destructiveHint: false });
  });

  it("derives a provider schema and hides host-bound arguments", () => {
    expect(toolFunctionSchema(saveNote, { omit: ["session_id"] })).toEqual({
      name: "save_note",
      description: "Save a note for a session",
      parameters: {
        type: "object",
        properties: { note: { type: "string", description: "The note" }, pinned: { type: "boolean" } },
        required: ["note"],
        additionalProperties: false,
      },
    });
  });

  it("runs agent tool calls through dispatch with bound arguments", async () => {
    const server = createKitServer({ kit: notesKit, db: { url: ":memory:" }, transport: "http" });
    const executeTool = vi.spyOn(server, "executeTool");
    const tools = kitAgentTools({
      kit: notesKit, executor: server, tools: ["save_note"],
      boundArgs: (session) => ({ session_id: session.id }), boundArgNames: ["session_id"],
      principal: () => "voice-agent",
    });
    const session = { id: "s-1" } as any;
    await expect(tools.definitions[0].execute({ note: "Order agreed" }, session, new AbortController().signal))
      .resolves.toEqual({ saved: "Order agreed", session: "s-1" });
    expect(executeTool).toHaveBeenCalledWith("notes", "save_note", { note: "Order agreed", session_id: "s-1" }, "voice-agent");
    // Validation still applies: an empty note is rejected by the tool's Zod schema.
    await expect(tools.definitions[0].execute({ note: "" }, session, new AbortController().signal)).rejects.toThrow();
  });
});
