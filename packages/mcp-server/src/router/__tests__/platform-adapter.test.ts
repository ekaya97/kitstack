import { describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { platformAdapter } from "../platform-adapter";
import { readAppResource } from "../app-resources";
import { DEBRIEF_SHELL_S3_KEY } from "../platform-adapter";
import type { KitRegistryItem, UserKitDbItem } from "../types";

vi.mock("../tool-dispatcher", () => ({
  dispatchToolCall: vi.fn(async () => ({ content: [{ type: "text", text: "crm result" }] })),
}));
vi.mock("../app-resources", () => ({
  getKitApps: vi.fn(async () => []),
  getKitShellS3Key: vi.fn(async () => null),
  readAppResource: vi.fn(async () => null),
}));

const SECRET = new TextEncoder().encode("router-to-demo-secret-that-is-32-bytes");

const existingTool: KitRegistryItem = {
  kitId: "crm",
  toolName: "list_contacts",
  toolDescription: "List contacts",
  inputSchema: JSON.stringify({ type: "object", properties: {} }),
  kitName: "CRM",
};

const userDb: UserKitDbItem = {
  userId: "user-1",
  kitId: "crm",
  dbUrl: "libsql://crm.turso.io",
  dbToken: "token",
  provisionedAt: "2026-01-01T00:00:00.000Z",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("platform debrief adapter", () => {
  it("resolves the published debrief shell from KitAssets without Lambda", async () => {
    vi.mocked(readAppResource).mockResolvedValueOnce({
      uri: "ui://kitstack/app",
      mimeType: "text/html;profile=mcp-app",
      text: "<!doctype html><html><body>debrief shell</body></html>",
    });
    const invokeKitLambda = vi.fn();
    const adapter = platformAdapter({
      getAllTools: vi.fn(async () => []),
      getUserKitDbs: vi.fn(async () => []),
      invokeKitLambda,
    });

    await expect(adapter.getShellHtml("debrief")).resolves.toContain("debrief shell");
    expect(readAppResource).toHaveBeenCalledWith(
      "ui://kitstack/app",
      "system",
      new Set(["debrief"]),
      DEBRIEF_SHELL_S3_KEY,
    );
    expect(invokeKitLambda).not.toHaveBeenCalled();
  });

  it("injects the virtual debrief kit with the current kit contracts", async () => {
    const getAllTools = vi.fn(async () => [existingTool]);
    const getUserKitDbs = vi.fn(async () => [userDb]);
    const adapter = platformAdapter({
      getAllTools,
      getUserKitDbs,
      invokeKitLambda: vi.fn(),
      voiceServiceUrl: "https://voice.example",
      voiceInternalSecret: SECRET,
    });

    const kits = await adapter.resolveUserKits("user-1");
    const debrief = kits.find((kit) => kit.id === "debrief");
    expect(debrief).toBeDefined();
    expect(debrief?.tools.map((tool) => tool.name)).toEqual([
      "prepare_debrief",
      "get_session",
      "get_debrief",
      "confirm_debrief",
      "teach_from_correction",
    ]);
    expect(debrief?.tools[0].inputSchema).toMatchObject({
      type: "object",
      required: ["goal", "company", "contact_name", "location", "callback_at", "callback_timezone"],
    });
    expect(debrief?.views).toEqual([{
      slug: "prebrief",
      name: "Sales Prebrief",
      description: expect.stringContaining("customer context"),
    }]);
  });

  it("forwards debrief calls with a short-lived signed internal identity", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = new Headers(init?.headers).get("authorization")?.replace(/^Bearer\s+/, "");
      expect(token).toBeTruthy();
      const verified = await jwtVerify(token!, SECRET, { algorithms: ["HS256"] });
      expect(verified.payload).toMatchObject({
        sub: "user-1",
        org: "org-demo",
        kit: "debrief",
        req: "http-request-1",
        trace: "trace-1",
      });
      expect(String(input)).toBe("https://voice.example/mcp");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        method: "tools/call",
        params: {
          name: "prepare_debrief",
          arguments: { company: "Acme Corp", callback_at: "22:05" },
        },
      });
      return response({
        jsonrpc: "2.0",
        id: "http-request-1",
        result: { content: [{ type: "text", text: "prepared" }] },
      });
    });
    const adapter = platformAdapter({
      getAllTools: vi.fn(async () => []),
      getUserKitDbs: vi.fn(async () => []),
      invokeKitLambda: vi.fn(),
      voiceServiceUrl: "https://voice.example",
      voiceInternalSecret: SECRET,
      fetch: fetcher,
      requestContext: { requestId: "http-request-1", traceId: "trace-1" },
    });

    const result = await adapter.executeTool("debrief", "prepare_debrief", {
      goal: "prepare the meeting",
      company: "Acme Corp",
      callback_at: "22:05",
    }, "user-1");

    expect(result).toEqual({ content: [{ type: "text", text: "prepared" }] });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("maps an unavailable voice service to a useful tool error", async () => {
    const adapter = platformAdapter({
      getAllTools: vi.fn(async () => []),
      getUserKitDbs: vi.fn(async () => []),
      invokeKitLambda: vi.fn(),
      voiceServiceUrl: "https://voice.example",
      voiceInternalSecret: SECRET,
      fetch: vi.fn(async () => { throw new Error("connect refused"); }),
    });

    const result = await adapter.executeTool("debrief", "get_session", { session_id: "s1" }, "user-1");
    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Sales debrief voice service unavailable: connect refused",
    });
  });

  it("keeps existing kits on the Lambda dispatch path", async () => {
    const { dispatchToolCall } = await import("../tool-dispatcher");
    const adapter = platformAdapter({
      getAllTools: vi.fn(async () => [existingTool]),
      getUserKitDbs: vi.fn(async () => [userDb]),
      invokeKitLambda: vi.fn(),
    });

    const result = await adapter.executeTool("crm", "list_contacts", {}, "user-1");
    expect(result.content[0]).toEqual({ type: "text", text: "crm result" });
    expect(dispatchToolCall).toHaveBeenCalledOnce();
  });
});
