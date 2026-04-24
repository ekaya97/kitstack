import { describe, it, expect, vi } from "vitest";
import { buildOnionTools, handleOnionCall } from "../onion-handler";
import type { KitRegistryItem } from "../../framework/types";

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

vi.mock("../../framework/dynamo", () => ({
  getUserKitDb: vi.fn(async () => ({
    userId: "user-1",
    kitId: "crm",
    dbUrl: "libsql://test.turso.io",
    dbToken: "tok",
    provisionedAt: "2026-01-01",
  })),
}));

describe("buildOnionTools", () => {
  it("returns one tool per kit", () => {
    const tools = buildOnionTools(mockTools);
    expect(tools).toHaveLength(2);

    const names = tools.map((t) => t.name);
    expect(names).toContain("crm");
    expect(names).toContain("meeting-action-tracker");
  });

  it("includes kit description in tool description", () => {
    const tools = buildOnionTools(mockTools);
    const crm = tools.find((t) => t.name === "crm")!;
    expect(crm.description).toContain("Full CRM");
    expect(crm.description).toContain("discover");
  });

  it("has correct onion input schema", () => {
    const tools = buildOnionTools(mockTools);
    const crm = tools.find((t) => t.name === "crm")!;
    expect(crm.inputSchema.properties).toHaveProperty("action");
    expect(crm.inputSchema.properties).toHaveProperty("name");
    expect(crm.inputSchema.properties).toHaveProperty("params");
    expect(crm.inputSchema.required).toEqual(["action"]);
  });
});

describe("handleOnionCall", () => {
  const getTools = async () => mockTools;
  const invokeLambda = vi.fn(async () => ({
    content: [{ type: "text", text: "Done" }],
  }));

  describe("discover", () => {
    it("returns action catalogue", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "discover" },
        "user-1",
        getTools,
        invokeLambda
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("add_contact");
      expect(text).toContain("list_contacts");
      expect(text).not.toContain("kitstack_crm_instructions");
    });

    it("includes kit name and description", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "discover" },
        "user-1",
        getTools,
        invokeLambda
      );
      expect(result.content[0].text).toContain("CRM Kit");
    });
  });

  describe("describe", () => {
    it("returns full JSON Schema for a named action", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "describe", name: "add_contact" },
        "user-1",
        getTools,
        invokeLambda
      );
      const text = result.content[0].text;
      expect(text).toContain("add_contact");
      expect(text).toContain('"name"');
      expect(text).toContain('"company"');
      expect(text).toContain("required");
    });

    it("returns error for unknown action", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "describe", name: "nonexistent" },
        "user-1",
        getTools,
        invokeLambda
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown action");
    });

    it("returns error when name is missing", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "describe" },
        "user-1",
        getTools,
        invokeLambda
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Missing");
    });
  });

  describe("execute", () => {
    it("delegates to dispatchToolCall", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "execute", name: "add_contact", params: { name: "Anna" } },
        "user-1",
        getTools,
        invokeLambda
      );
      expect(result.content[0].text).toBe("Done");
    });

    it("returns error when name is missing", async () => {
      const result = await handleOnionCall(
        "crm",
        { action: "execute", params: { name: "Anna" } },
        "user-1",
        getTools,
        invokeLambda
      );
      expect(result.isError).toBe(true);
    });
  });

  it("returns error for unknown kit", async () => {
    const result = await handleOnionCall(
      "nonexistent-kit",
      { action: "discover" },
      "user-1",
      getTools,
      invokeLambda
    );
    expect(result.isError).toBe(true);
  });
});
