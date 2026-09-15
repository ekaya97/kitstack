/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DemoPage from "./page";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ events: [], aggregate: { totalEvents: 0, totalRequestTokens: 0, totalResponseTokens: 0, totalEstimatedCostUsd: 0, totalLatencyMs: 0, successCount: 0, errorCount: 0 }, mcpAuthMode: "app-token" }),
  });
});

describe("demo observability page", () => {
  it("loads with the observability views and empty state", async () => {
    render(<DemoPage />);
    expect(screen.getByText("Developer observability")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Usage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Session Trace" })).toBeTruthy();
    expect(screen.getAllByText("MCP app-token").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });

  it("shows presenter metrics from telemetry and supports manual refresh", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          { id: "event-1", timestamp: "2026-01-01T00:00:00.000Z", orgId: "org-demo", appId: "app_demo", sessionId: "session-1", channel: "voice", type: "tool", operation: "start_voice_call", outcome: "success", memoryIds: ["memory-1", "memory-2"], instructionVersions: ["instructions:v1"] },
        ],
        aggregate: { totalEvents: 1, totalRequestTokens: 10, totalResponseTokens: 20, totalEstimatedCostUsd: 0.1234, totalLatencyMs: 100, successCount: 1, errorCount: 0 },
        mcpAuthMode: "app-token",
      }),
    });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Sessions").parentElement?.textContent).toContain("1");
    expect(screen.getByText("Memory refs").parentElement?.textContent).toContain("2");
    expect(screen.getByText("Instruction refs").parentElement?.textContent).toContain("1");
    expect(screen.getByText("Voice calls").parentElement?.textContent).toContain("1");
    expect(screen.getByText("$0.1234")).toBeTruthy();
    expect(screen.getByText("No errors")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("uses a safe auth label when the API does not report a mode", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], aggregate: null }) });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    expect(screen.getAllByText("MCP auth mode not reported").length).toBeGreaterThan(0);
  });

  it("keeps an issued token masked until explicit reveal", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], aggregate: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "app_demo", name: "Demo", org: "org-demo", scopes: ["inference"], createdAt: "2026-01-01T00:00:00.000Z" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "secret-demo-token", expiresInSeconds: 900 }) });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Register + issue token" }));
    await waitFor(() => expect(screen.getByText(/secret-demo-/)).toBeTruthy());
    expect(screen.getByText(/••••/)).toBeTruthy();
    expect(screen.queryByText("secret-demo-token")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reveal token once" }));
    expect(screen.getByText("secret-demo-token")).toBeTruthy();
  });
});
