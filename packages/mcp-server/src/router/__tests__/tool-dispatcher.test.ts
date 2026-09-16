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

vi.mock("../authz", () => ({
  mcpCheckTuple: vi.fn(async () => true),
}));

vi.mock("../oauth-store", () => ({
  getOAuthItem: vi.fn(async () => null),
  putOAuthItem: vi.fn(async () => undefined),
}));

import { getUserKitDb } from "../../db/dynamo";
import { mcpCheckTuple } from "../authz";

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
