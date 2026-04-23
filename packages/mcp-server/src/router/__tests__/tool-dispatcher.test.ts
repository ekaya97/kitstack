import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchToolCall } from "../tool-dispatcher";
import type { KitRegistryItem } from "../../framework/types";

const mockTools: KitRegistryItem[] = [
  {
    kitId: "kit-meeting",
    toolName: "process_meeting",
    toolDescription: "Process meeting",
    inputSchema: "{}",
    lambdaArn: "arn:aws:lambda:eu-central-1:123:function:KitMeeting",
    kitName: "Meeting Kit",
  },
];

const getAllTools = vi.fn(async () => mockTools);

const invokeKitLambda = vi.fn(async () => ({
  content: [{ type: "text", text: "Done" }],
}));

vi.mock("../../framework/dynamo", () => ({
  getUserKitDb: vi.fn(),
}));

import { getUserKitDb } from "../../framework/dynamo";

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
    expect(result.content[0].text).toContain("Unknown tool");
  });

  it("returns error when kit is not activated", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce(null);

    const result = await dispatchToolCall(
      "process_meeting",
      {},
      "user-1",
      getAllTools,
      invokeKitLambda
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not activated");
  });

  it("invokes kit lambda with correct payload", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "kit-meeting",
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
      "arn:aws:lambda:eu-central-1:123:function:KitMeeting",
      expect.objectContaining({
        toolName: "process_meeting",
        args: { title: "Sprint" },
        userId: "user-1",
        dbUrl: "libsql://test.turso.io",
      })
    );

    expect(result.content[0].text).toBe("Done");
  });
});
