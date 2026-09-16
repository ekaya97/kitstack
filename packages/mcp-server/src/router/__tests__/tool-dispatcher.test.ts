import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchToolCall } from "../tool-dispatcher";
import type { KitRegistryItem } from "../types";
import { textOf } from "../../test/helpers";

const mockTools: KitRegistryItem[] = [
  {
    kitId: "meeting-action-tracker",
    toolName: "process_meeting",
    toolDescription: "Process meeting",
    inputSchema: "{}",
    kitName: "Meeting Kit",
  },
];

const getAllTools = vi.fn(async () => mockTools);

const invokeKitLambda = vi.fn(async () => ({
  content: [{ type: "text", text: "Done" }],
}));

vi.mock("../../db/dynamo", () => ({
  getUserKitDb: vi.fn(),
}));

vi.mock("../authz", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../authz")>()),
  mcpCheckTuple: vi.fn(async () => true),
}));

vi.mock("../oauth-store", () => ({
  getOAuthItem: vi.fn(async () => null),
  putOAuthItem: vi.fn(async () => undefined),
}));

vi.mock("../audit", () => ({
  audit: vi.fn(),
}));

import { getUserKitDb } from "../../db/dynamo";
import { mcpCheckTuple } from "../authz";
import { audit } from "../audit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dispatchToolCall", () => {
  it("returns error for unknown tool", async () => {
    const result = await dispatchToolCall(
      "nonexistent_tool",
      {},
      "user-1",
      getAllTools,
      invokeKitLambda
    );
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Unknown tool");
  });

  it("returns error when kit is not activated", async () => {
    vi.mocked(mcpCheckTuple).mockResolvedValueOnce(false);

    const result = await dispatchToolCall(
      "process_meeting",
      {},
      "user-1",
      getAllTools,
      invokeKitLambda
    );
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not activated");
  });

  it("invokes kit lambda with correct payload", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting-action-tracker",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01",
    });

    const result = await dispatchToolCall(
      "process_meeting",
      { title: "Sprint" },
      "user-1",
      getAllTools,
      invokeKitLambda
    );

    expect(invokeKitLambda).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        toolName: "process_meeting",
        args: { title: "Sprint" },
        userId: "user-1",
        dbUrl: "libsql://test.turso.io",
      })
    );

    expect(textOf(result)).toBe("Done");
    expect(mcpCheckTuple).toHaveBeenCalledWith(
      "user-1",
      "kit:use",
      "kit",
      "meeting-action-tracker-kit",
      "user",
    );
  });

  it("requires kit:act for tools marked act", async () => {
    const actTool = { ...mockTools[0], mode: "act" as const };
    getAllTools.mockResolvedValueOnce([actTool]);
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting-action-tracker",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01",
    });

    const result = await dispatchToolCall(
      "process_meeting",
      { notes: "sensitive" },
      "user-1",
      getAllTools,
      invokeKitLambda,
    );

    expect(result.isError).not.toBe(true);
    expect(mcpCheckTuple).toHaveBeenCalledWith(
      "user-1",
      "kit:act",
      "kit",
      "meeting-action-tracker-kit",
      "user",
    );
  });

  it("denies an act tool before loading or invoking the kit", async () => {
    const actTool = { ...mockTools[0], mode: "act" as const };
    getAllTools.mockResolvedValueOnce([actTool]);
    vi.mocked(mcpCheckTuple).mockResolvedValueOnce(false);

    const result = await dispatchToolCall(
      "process_meeting",
      { notes: "do not log this" },
      "user-1",
      getAllTools,
      invokeKitLambda,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not authorized");
    expect(getUserKitDb).not.toHaveBeenCalled();
    expect(invokeKitLambda).not.toHaveBeenCalled();
  });

  it("rejects a service request that tries to impersonate a user and redacts args from audit", async () => {
    const actTool = { ...mockTools[0], mode: "act" as const };
    getAllTools.mockResolvedValueOnce([actTool]);

    const result = await dispatchToolCall(
      "process_meeting",
      { secret_customer_notes: "do not audit this" },
      "user-1",
      getAllTools,
      invokeKitLambda,
      {
        identity: {
          principal: "user-1",
          actor: "service:voice-agent",
          kind: "service",
        },
      },
    );

    expect(result.isError).toBe(true);
    expect(mcpCheckTuple).not.toHaveBeenCalled();
    expect(getUserKitDb).not.toHaveBeenCalled();
    expect(invokeKitLambda).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith({
      action: "tool.call.error",
      userId: "user-1",
      toolName: "process_meeting",
      kitId: "meeting-action-tracker",
      detail: "kit not authorized",
    });
    expect(audit).not.toHaveBeenCalledWith(expect.objectContaining({ args: expect.anything() }));
  });

  it("includes request session trace fields in the Lambda wire payload", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting-action-tracker",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01",
    });

    await dispatchToolCall(
      "process_meeting",
      { title: "Sprint" },
      "user-1",
      getAllTools,
      invokeKitLambda,
      {
        sessionId: "session-1",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        parentId: "00f067aa0ba902b7",
      },
    );

    expect(invokeKitLambda).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sessionId: "session-1",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        parentId: "00f067aa0ba902b7",
      }),
    );
  });
});
