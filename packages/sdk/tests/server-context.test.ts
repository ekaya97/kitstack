import { describe, expect, it } from "vitest";
import { createProtocolHandler } from "../src/server/protocol";
import type { KitServerAdapter } from "../src/server/types";

describe("server request context", () => {
  it("forwards identity correlation to a View loader", async () => {
    let received: unknown;
    const adapter: KitServerAdapter = {
      resolveUserKits: async () => [{
        id: "demo",
        name: "Demo",
        description: "Demo kit",
        triggers: [],
        instructions: null,
        tools: [],
        views: [{ slug: "overview", name: "Overview", description: "Summary" }],
      }],
      executeTool: async () => ({ content: [] }),
      executeLoader: async (_kitId, _viewSlug, _userId, context) => {
        received = context;
        return { ok: true };
      },
      getShellHtml: async () => "<html></html>",
    };
    const protocol = createProtocolHandler({ adapter });

    const response = await protocol.handleRequest({
      id: 1,
      method: "tools/call",
      params: { name: "kit_view", arguments: { id: "demo", view: "overview" } },
    }, "user-1", {
      requestId: "request-1",
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
    });

    expect(response?.result).toMatchObject({ content: expect.any(Array) });
    expect(received).toEqual({
      requestId: "request-1",
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
    });
  });
});
