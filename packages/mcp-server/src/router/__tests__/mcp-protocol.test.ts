import { describe, it, expect, vi } from "vitest";
import { handleMcpRequest } from "../mcp-protocol";
import type { KitRegistryItem, UserKitDbItem, JsonRpcRequest } from "../../framework/types";
import { textOf } from "../../test/helpers";

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

    kitName: "Meeting Action Tracker Kit",
    kitDescription: "Track action items across meetings",
  },
  {
    kitId: "kit-meeting",
    toolName: "list_meetings",
    toolDescription: "List all meetings",
    inputSchema: JSON.stringify({ type: "object", properties: {} }),

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

  describe("tools/list — kit + kit_view tools", () => {
    it("returns kit and kit_view tools", async () => {
      const res = await handleMcpRequest(
        rpc("tools/list"),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("kit");
      expect(result.tools[1].name).toBe("kit_view");
    });

    it("returns the same tools regardless of user activations", async () => {
      const noKits = vi.fn(async () => [] as UserKitDbItem[]);
      const res = await handleMcpRequest(
        rpc("tools/list"),
        "user-1",
        getAllTools,
        noKits,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("kit");
      expect(result.tools[1].name).toBe("kit_view");
    });
  });

  describe("tools/call — kit()", () => {
    it("lists activated kits when called with no args", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", { name: "kit", arguments: {} }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(textOf(result)).toContain("kit-meeting");
      expect(textOf(result)).not.toContain("kit-crm");
    });

    it("discovers actions when called with id", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", { name: "kit", arguments: { id: "kit-meeting" } }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(textOf(result)).toContain("process_meeting");
      expect(textOf(result)).toContain("list_meetings");
    });

    it("describes an action when called with id + cmd", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", { name: "kit", arguments: { id: "kit-meeting", cmd: "process_meeting" } }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(textOf(result)).toContain("process_meeting");
      expect(textOf(result)).toContain("Parameters");
      expect(textOf(result)).toContain("title");
    });

    it("runs an action when called with id + cmd + params", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", {
          name: "kit",
          arguments: { id: "kit-meeting", cmd: "process_meeting", params: { title: "Test" } },
        }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(textOf(result)).toContain("Meeting processed");
    });

    it("returns error for non-activated kit", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", { name: "kit", arguments: { id: "kit-crm" } }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      const result = res.response.result as any;
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("not activated");
    });

    it("returns error for unknown tool name", async () => {
      const res = await handleMcpRequest(
        rpc("tools/call", { name: "unknown_tool" }),
        "user-1",
        getAllTools,
        getUserKitDbs,
        invokeKitLambda
      );
      expect(res.response.error).toBeDefined();
      expect(res.response.error!.message).toContain("Unknown tool");
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
