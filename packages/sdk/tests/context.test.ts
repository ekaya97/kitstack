import { describe, expect, it, vi } from "vitest";
import { createKitContext } from "../src/context";
import { defineLoader } from "../src/define-loader";
import { defineTool } from "../src/define-tool";
import { kit } from "../src/result";

describe("request-scoped KitContext", () => {
  it("contains the reviewed context seams and preserves supplied request metadata", () => {
    const db = {} as any;
    const telemetry = { event: vi.fn(), metric: vi.fn() };
    const audit = { record: vi.fn() };
    const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const context = createKitContext({
      db,
      identity: { principal: "user-1", actor: "service-1", delegation: "delegation-1" },
      channel: { kind: "voice", id: "call-1" },
      session: { id: "session-1", traceId: "trace-1", parentId: "parent-1" },
      telemetry,
      audit,
      log,
    });

    expect(context).toMatchObject({
      db,
      identity: { principal: "user-1", actor: "service-1", delegation: "delegation-1" },
      channel: { kind: "voice", id: "call-1" },
      session: { id: "session-1", traceId: "trace-1", parentId: "parent-1" },
      telemetry,
      audit,
      log,
    });
    expect(context.connectors.has("missing")).toBe(false);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("passes the same context object to auto-wrapped tools and loaders", async () => {
    const context = createKitContext({ db: {} as any });
    const load = vi.fn(async (ctx: typeof context, args: { value: string }) => ({
      principal: ctx.identity.principal,
      value: args.value,
    }));
    const tool = defineTool({
      name: "read_context",
      description: "Read request context metadata",
      args: { safeParse: () => ({ success: true, data: { value: "ok" } }) } as any,
      load,
    });
    const loader = defineLoader(async (ctx) => tool.load(ctx, { value: "loader" }));

    await tool.handler!(context, { value: "tool" });
    await loader(context);

    expect(load).toHaveBeenNthCalledWith(1, context, { value: "tool" });
    expect(load).toHaveBeenNthCalledWith(2, context, { value: "loader" });
  });

  it("keeps explicit handler argument order as (ctx, args)", async () => {
    const context = createKitContext({ db: {} as any });
    const handler = vi.fn(async (ctx: typeof context, args: { value: string }) => {
      ctx.telemetry.event("context.test", { value: args.value });
      return kit.text(args.value);
    });
    const tool = defineTool({
      name: "write_context",
      description: "Write request context metadata",
      args: { safeParse: () => ({ success: true, data: { value: "ok" } }) } as any,
      handler,
    });

    await tool.handler!(context, { value: "act" });

    expect(handler).toHaveBeenCalledWith(context, { value: "act" });
  });
});
