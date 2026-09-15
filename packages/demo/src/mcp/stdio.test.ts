import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoApp, type DemoApp } from "../app/index.js";
import { createDemoMcpStdio, type DemoMcpResponse } from "./stdio.js";

let app: DemoApp | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function responseLines(output: PassThrough): DemoMcpResponse[] {
  const text = output.read()?.toString("utf8") ?? "";
  return text.trim().split("\n").filter(Boolean).map((line: string) => JSON.parse(line) as DemoMcpResponse);
}

describe("demo MCP stdio adapter", () => {
  it("supports the standard initialize, notification, ping, and tools/list lifecycle", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const adapter = await createDemoMcpStdio({ app });

    await expect(adapter.handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize" })).resolves.toMatchObject({
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
      },
    });
    await expect(adapter.handleRequest({ jsonrpc: "2.0", method: "notifications/initialized" })).resolves.toBeNull();
    await expect(adapter.handleRequest({ jsonrpc: "2.0", id: 2, method: "ping" })).resolves.toMatchObject({ id: 2, result: {} });

    const listed = await adapter.handleRequest({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    const tools = (listed as DemoMcpResponse).result as { tools: Array<{ name: string; inputSchema: { required?: string[] } }> };
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "prepare_debrief", "get_session", "get_debrief", "confirm_debrief", "teach_from_correction",
    ]);
    expect(tools.tools[0].inputSchema.required).toEqual(["goal"]);
  });

  it("runs a debrief tool call through the shared demo services over stdio", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const input = new PassThrough();
    const output = new PassThrough();
    const adapter = await createDemoMcpStdio({ app, input, output });
    const running = adapter.run();

    input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }) + "\n");
    input.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "prepare_debrief", arguments: { goal: "Qualify the next opportunity" } },
    }) + "\n");
    input.end();
    await running;

    const responses = responseLines(output);
    expect(responses.map((response) => response.id)).toEqual([1, 2, 3, 4]);
    const prepared = JSON.parse(((responses[3].result as any).content[0].text)) as { state: string; goal: string };
    expect(prepared).toMatchObject({ state: "prepared", goal: "Qualify the next opportunity" });
  });

  it("returns protocol errors without writing non-protocol output", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const adapter = await createDemoMcpStdio({ app });

    await expect(adapter.handleRequest({ jsonrpc: "2.0", id: 7, method: "unknown" })).resolves.toMatchObject({
      id: 7,
      error: { code: -32601 },
    });
    await expect(adapter.handleRequest({
      jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "prepare_debrief", arguments: {} },
    })).resolves.toMatchObject({
      id: 8,
      error: { code: -32603, message: "goal is required" },
    });
  });
});
