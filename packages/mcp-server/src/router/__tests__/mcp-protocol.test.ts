import { describe, it, expect, vi } from "vitest";
import { handleMcpRequest, ONION_MODE_THRESHOLD } from "../mcp-protocol";
import type { KitRegistryItem, UserKitDbItem, JsonRpcRequest } from "../../framework/types";

const mockTools: KitRegistryItem[] = [
  {
    kitId: "kit-meeting",
    toolName: "process_meeting",
    toolDescription: "Extract actions from meeting notes",
    inputSchema: JSON.stringify({
      type: "object",
      properties: { title: { type: "string" }, notes: { type: "string" } },
      required: ["title", "notes"],
    }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitMeeting",
    kitName: "Meeting Action Tracker Kit",
    kitDescription: "Track action items across meetings",
  },
  {
    kitId: "kit-meeting",
    toolName: "list_meetings",
    toolDescription: "List all meetings",
    inputSchema: JSON.stringify({ type: "object", properties: {} }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitMeeting",
    kitName: "Meeting Action Tracker Kit",
    kitDescription: "Track action items across meetings",
  },
  {
    kitId: "kit-crm",
    toolName: "add_contact",
    toolDescription: "Add a new contact",
    inputSchema: JSON.stringify({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitCrm",
    kitName: "CRM Kit",
    kitDescription: "Full CRM with contacts and deals",
  },
];

// User has only activated kit-meeting, NOT kit-crm
const mockUserDbs: UserKitDbItem[] = [
  {
    userId: "user-1",
    kitId: "kit-meeting",
    dbUrl: "libsql://test.turso.io",
    dbToken: "tok",
    provisionedAt: "2026-01-01",
  },
];

const getAllTools = vi.fn(async () => mockTools);
const getUserKitDbs = vi.fn(async () => mockUserDbs);
const invokeKitLambda = vi.fn(async () => ({
  content: [{ type: "text", text: "Meeting processed" }],
}));

vi.mock("../../framework/dynamo", () => ({
  getUserKitDb: vi.fn(async (userId: string, kitId: string) => {
    return mockUserDbs.find((d) => d.userId === userId && d.kitId === kitId) ?? null;
  }),
  checkAndClearToolsChanged: vi.fn(async () => false),
}));

function rpc(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: "2.0", id: 1, method, params };
}

describe("handleMcpRequest", () => {
  describe("initialize", () => {
    it("returns server info and capabilities", async () => {
      const res = await handleMcpRequest(
        rpc("initialize"),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      expect(res.response.result).toBeDefined();
      const result = res.response.result as any;
      expect(result.serverInfo.name).toBe("kitstack");
      expect(result.capabilities.tools).toBeDefined();
    });
  });

  describe("tools/list — entitlement filtering", () => {
    it("only returns tools for activated kits", async () => {
      const res = await handleMcpRequest(
        rpc("tools/list"),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      // User only has kit-meeting activated, so only meeting tools returned
      expect(result.tools).toHaveLength(2);
      expect(result.tools.every((t: any) => t.name.includes("meeting") || t.name.includes("list_meetings") || t.name.includes("process_meeting"))).toBe(true);
    });

    it("does not return tools for non-activated kits", async () => {
      const res = await handleMcpRequest(
        rpc("tools/list"),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      const names = result.tools.map((t: any) => t.name);
      expect(names).not.toContain("add_contact");
    });

    it("returns empty tools for user with no activations", async () => {
      const noKits = vi.fn(async () => [] as UserKitDbItem[]);
      const res = await handleMcpRequest(
        rpc("tools/list"),
        "user-1",
        getAllTools,
        noKits,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(result.tools).toHaveLength(0);
    });
  });

  describe("tools/call", () => {
    it("dispatches to the correct kit lambda for activated kit", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", { name: "process_meeting", arguments: { title: "Test" } }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );

      expect(res.response.error).toBeUndefined();
      const result = res.response.result as any;
      expect(result.content[0].text).toContain("Meeting processed");
    });

    it("returns error for missing tool name", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", {}),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      expect(res.response.error).toBeDefined();
      expect(res.response.error!.message).toContain("Missing tool name");
    });
  });

  describe("unknown method", () => {
    it("returns method not found", async () => {
      const res = await handleMcpRequest(
        rpc("unknown/method"),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      expect(res.response.error).toBeDefined();
      expect(res.response.error!.code).toBe(-32601);
    });
  });
});
