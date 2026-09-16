import { describe, expect, it } from "vitest";
import {
  parseTraceparent,
  resolveTraceparent,
  traceparentFromIds,
} from "../trace-context";

const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("W3C traceparent boundary", () => {
  it("parses a valid traceparent and exposes session-compatible IDs", () => {
    expect(parseTraceparent(TRACEPARENT)).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
      traceparent: TRACEPARENT,
    });
  });

  it.each([
    "",
    "not-a-traceparent",
    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7",
    "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
    "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01",
    "00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01",
    "ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra",
  ])("rejects malformed or unsafe input: %s", (value) => {
    expect(parseTraceparent(value)).toBeNull();
  });

  it("does not throw or propagate malformed input", () => {
    const resolved = resolveTraceparent("00-not-valid", "also-not-valid");

    expect(resolved.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(resolved.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(resolved.parentId).toMatch(/^[0-9a-f]{16}$/);
    expect(resolved.traceparent).not.toContain("not-valid");
  });

  it("honors a valid inbound traceparent unchanged", () => {
    expect(resolveTraceparent(`  ${TRACEPARENT}  `, "f".repeat(32))).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
      traceparent: TRACEPARENT,
    });
  });

  it("uses a valid legacy trace ID only when no W3C header exists", () => {
    const legacy = "4bf92f3577b34da6a3ce929d0e0e4736";
    const resolved = resolveTraceparent(undefined, legacy);

    expect(resolved.traceId).toBe(legacy);
    expect(resolved.traceparent).toMatch(new RegExp(`^00-${legacy}-[0-9a-f]{16}-01$`));
  });

  it("builds a traceparent only from valid IDs", () => {
    expect(traceparentFromIds("4bf92f3577b34da6a3ce929d0e0e4736", "00f067aa0ba902b7"))
      .toBe(TRACEPARENT);
    expect(traceparentFromIds("trace-id", "parent-id")).toBeNull();
  });
});
