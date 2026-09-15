/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildPluginRows, PluginObservabilityView } from "./plugin-observability";

const events = [
  { id: "registered", timestamp: "2026-01-01T00:00:00.000Z", pluginId: "kit:debrief", type: "plugin.registered", operation: "register", outcome: "success" },
  { id: "invoke", timestamp: "2026-01-01T00:01:00.000Z", pluginId: "kit:debrief", type: "mcp.tool_call", operation: "prepare", outcome: "success" },
  { id: "error", timestamp: "2026-01-01T00:02:00.000Z", pluginId: "memory:default", type: "memory.read", operation: "read", outcome: "error" },
];

describe("plugin observability view", () => {
  it("derives registration and activity from existing telemetry events", () => {
    const rows = buildPluginRows(events);
    expect(rows).toEqual([
      { id: "kit:debrief", kind: "Not reported", version: "Not reported", status: "Registered", registeredAt: "2026-01-01T00:00:00.000Z", invocationCount: 1, lastInvokedAt: "2026-01-01T00:01:00.000Z", errorCount: 0 },
      { id: "memory:default", kind: "Not reported", version: "Not reported", status: "Observed", registeredAt: null, invocationCount: 1, lastInvokedAt: "2026-01-01T00:02:00.000Z", errorCount: 1 },
    ]);
  });

  it("uses registry fields when the API eventually supplies them", () => {
    render(<PluginObservabilityView events={events} plugins={[{ id: "kit:debrief", kind: "kit", version: "0.1.0", status: "ready", invocationCount: 7 }]} />);
    expect(screen.getByText("kit")).toBeTruthy();
    expect(screen.getByText("0.1.0")).toBeTruthy();
    expect(screen.getByText("ready")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getAllByText("Not reported").length).toBeGreaterThan(0);
  });

  it("shows an empty state without fabricating plugin data", () => {
    render(<PluginObservabilityView events={[]} />);
    expect(screen.getByText("No plugin activity")).toBeTruthy();
    expect(screen.getByText(/derived from the existing metadata-only observability events/)).toBeTruthy();
  });
});
