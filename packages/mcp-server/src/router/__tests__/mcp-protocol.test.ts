import { describe, it, expect, vi } from "vitest";
import { handleMcpRequest } from "../mcp-protocol";
import type { KitRegistryItem, JsonRpcRequest } from "../../framework/types";

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
  },
  {
    kitId: "kit-meeting",
    toolName: "list_meetings",
    toolDescription: "List all meetings",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {},
    }),
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitMeeting",
    kitName: "Meeting Action Tracker Kit",
  },
];

const getAllTools = vi.fn(async () => mockTools);
const invokeKitLambda = vi.fn(async () => ({
  content: [{ type: "text", text: "Meeting processed" }],
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
        invokeKitLambda
      );
      expect(res.result).toBeDefined();
      const result = res.result as any;
      expect(result.serverInfo.name).toBe("kitstack-mcp");
      expect(result.capabilities.tools).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("returns tool definitions from registry", async () => {
      const res = await handleMcpRequest(
        rpc("tools/list"),
        "user-1",
        getAllTools,
        invokeKitLambda
      );
      const result = res.result as any;
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("process_meeting");
      expect(result.tools[0].inputSchema.type).toBe("object");
    });
  });

  describe("tools/call", () => {
    it("dispatches to the correct kit lambda", async () => {
      // Mock getUserKitDb via the dispatcher
      vi.mock("../../framework/dynamo", () => ({
        getUserKitDb: vi.fn(async () => ({
          userId: "user-1",
          kitId: "kit-meeting",
          dbUrl: "libsql://test.turso.io",
          dbToken: "tok",
          provisionedAt: "2026-01-01",
        })),
        getAllRegistryItems: vi.fn(async () => mockTools),
      }));

      const res = await handleMcpRequest(
        rpc("tools/call", { name: "process_meeting", arguments: { title: "Test" } }),
        "user-1",
        getAllTools,
        invokeKitLambda
      );

      expect(res.error).toBeUndefined();
      const result = res.result as any;
      expect(result.content[0].text).toContain("Meeting processed");
    });

    it("returns error for missing tool name", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", {}),
        "user-1",
        getAllTools,
        invokeKitLambda
      );
      expect(res.error).toBeDefined();
      expect(res.error!.message).toContain("Missing tool name");
    });
  });

  describe("unknown method", () => {
    it("returns method not found", async () => {
      const res = await handleMcpRequest(
        rpc("unknown/method"),
        "user-1",
        getAllTools,
        invokeKitLambda
      );
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32601);
    });
  });
});
