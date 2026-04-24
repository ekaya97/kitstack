import { describe, it, expect, vi } from "vitest";
import { KIT_TOOL_DEFINITION, handleKitCall } from "../kit-handler";
import type { KitRegistryItem, UserKitDbItem } from "../../framework/types";

const mockTools: KitRegistryItem[] = [
  {
    kitId: "crm",
    toolName: "add_contact",
    toolDescription: "Add a new contact",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        name: { type: "string", description: "Contact name" },
        company: { type: "string", description: "Company name" },
      },
      required: ["name"],
    }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitCrm",
    kitName: "CRM Kit",
    kitDescription: "Full CRM with contacts, deals, pipeline, and proposals",
  },
  {
    kitId: "crm",
    toolName: "list_contacts",
    toolDescription: "List all contacts",
    inputSchema: JSON.stringify({ type: "object", properties: {} }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitCrm",
    kitName: "CRM Kit",
    kitDescription: "Full CRM with contacts, deals, pipeline, and proposals",
  },
  {
    kitId: "crm",
    toolName: "kitstack_crm_instructions",
    toolDescription: "Load behavioral instructions for the CRM Kit",
    inputSchema: JSON.stringify({ type: "object", properties: {} }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitCrm",
    kitName: "CRM Kit",
    kitDescription: "Full CRM with contacts, deals, pipeline, and proposals",
  },
  {
    kitId: "meeting-action-tracker",
    toolName: "process_meeting",
    toolDescription: "Extract actions from meeting notes",
    inputSchema: JSON.stringify({
      type: "object",
      properties: { title: { type: "string" }, notes: { type: "string" } },
      required: ["title", "notes"],
    }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitMeeting",
    kitName: "Meeting Action Tracker Kit",
    kitDescription: "Track action items across meetings with persistent history",
  },
];

const mockUserDbs: UserKitDbItem[] = [
  {
    userId: "user-1",
    kitId: "crm",
    dbUrl: "libsql://test.turso.io",
    dbToken: "tok",
    provisionedAt: "2026-01-01",
  },
  {
    userId: "user-1",
    kitId: "meeting-action-tracker",
    dbUrl: "libsql://test2.turso.io",
    dbToken: "tok2",
    provisionedAt: "2026-01-01",
  },
];

vi.mock("../../framework/dynamo", () => ({
  getUserKitDb: vi.fn(async (userId: string, kitId: string) => {
    return mockUserDbs.find((d) => d.userId === userId && d.kitId === kitId) ?? null;
  }),
}));

const getTools = async () => mockTools;
const getUserDbs = async () => mockUserDbs;
const invokeLambda = vi.fn(async () => ({
  content: [{ type: "text", text: "Done" }],
}));

describe("KIT_TOOL_DEFINITION", () => {
  it("has correct name and schema", () => {
    expect(KIT_TOOL_DEFINITION.name).toBe("kit");
    expect(KIT_TOOL_DEFINITION.inputSchema.properties).toHaveProperty("id");
    expect(KIT_TOOL_DEFINITION.inputSchema.properties).toHaveProperty("cmd");
    expect(KIT_TOOL_DEFINITION.inputSchema.properties).toHaveProperty("params");
    expect(KIT_TOOL_DEFINITION.inputSchema.required).toBeUndefined();
  });
});

describe("handleKitCall", () => {
  describe("kit() — list kits", () => {
    it("returns activated kits", async () => {
      const result = await handleKitCall(
        {},
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("crm");
      expect(text).toContain("meeting-action-tracker");
    });

    it("excludes kitstack_ instruction tools from action counts", async () => {
      const result = await handleKitCall(
        {},
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      const text = result.content[0].text;
      // CRM has 2 real tools (add_contact, list_contacts), not 3
      expect(text).toContain("2");
    });

    it("shows no-kits message when none activated", async () => {
      const result = await handleKitCall(
        {},
        "user-1",
        getTools,
        async () => [],
        invokeLambda
      );
      expect(result.content[0].text).toContain("No kits activated");
    });
  });

  describe("kit(id) — discover", () => {
    it("returns action catalogue", async () => {
      const result = await handleKitCall(
        { id: "crm" },
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("add_contact");
      expect(text).toContain("list_contacts");
      expect(text).not.toContain("kitstack_crm_instructions");
    });

    it("includes kit name and description", async () => {
      const result = await handleKitCall(
        { id: "crm" },
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      expect(result.content[0].text).toContain("CRM Kit");
    });

    it("returns error for non-activated kit", async () => {
      const result = await handleKitCall(
        { id: "nonexistent-kit" },
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not activated");
    });
  });

  describe("kit(id, cmd) — describe", () => {
    it("returns full JSON Schema for an action", async () => {
      const result = await handleKitCall(
        { id: "crm", cmd: "add_contact" },
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      const text = result.content[0].text;
      expect(text).toContain("add_contact");
      expect(text).toContain('"name"');
      expect(text).toContain('"company"');
      expect(text).toContain("required");
    });

    it("returns error for unknown action", async () => {
      const result = await handleKitCall(
        { id: "crm", cmd: "nonexistent" },
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown action");
    });
  });

  describe("kit(id, cmd, params) — run", () => {
    it("delegates to dispatchToolCall", async () => {
      const result = await handleKitCall(
        { id: "crm", cmd: "add_contact", params: { name: "Anna" } },
        "user-1",
        getTools,
        getUserDbs,
        invokeLambda
      );
      expect(result.content[0].text).toBe("Done");
    });
  });
});
