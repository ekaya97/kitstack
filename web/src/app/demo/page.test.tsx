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

  it("labels auth-none as loopback-only", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], aggregate: null, mcpAuthMode: "none" }) });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    expect(screen.getAllByText("MCP auth-none (loopback)").length).toBeGreaterThan(0);
  });

  it("labels simulator and live providers without fabricating missing evidence", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({
      events: [{ id: "sim-event", timestamp: "2026-01-01T00:00:00.000Z", orgId: "org-demo", appId: "app_demo", sessionId: "sim-session", channel: "voice", type: "voice.call", operation: "start", outcome: "started", model: "simulator-german-sales-v1" }],
      voiceSessions: [{ sessionId: "live-session", status: "confirmed", provider: "realtime", model: "gpt-4o-realtime-preview", latencyMs: 240, estimatedCostUsd: 0.0312 }],
      aggregate: null,
    }) });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Voice session" }), { target: { value: "live-session" } });
    expect(screen.getAllByText("Live · realtime").length).toBeGreaterThan(0);
    expect(screen.getByText("gpt-4o-realtime-preview")).toBeTruthy();
    expect(screen.getByText("240 ms")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Voice session" }), { target: { value: "sim-session" } });
    expect(screen.getByText("Simulator")).toBeTruthy();
  });

  it("refreshes the selected session status while preserving the page state", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [{ id: "start", timestamp: "2026-01-01T00:00:00.000Z", orgId: "org-demo", appId: "app_demo", sessionId: "session-1", channel: "voice", type: "voice.call", operation: "start", outcome: "started" }], aggregate: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [{ id: "complete", timestamp: "2026-01-01T00:01:00.000Z", orgId: "org-demo", appId: "app_demo", sessionId: "session-1", channel: "voice", type: "voice.call", operation: "complete", outcome: "success", provider: "realtime", model: "live-model", latencyMs: 410, estimatedCostUsd: 0.04 }], aggregate: null }) });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Calling")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByText("Confirmed")).toBeTruthy());
    expect(screen.getByText("Live · realtime")).toBeTruthy();
  });

  it("keeps the live destination masked and requires explicit confirmation", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({
      events: [{ id: "event-1", timestamp: "2026-01-01T00:00:00.000Z", orgId: "org-demo", appId: "app_demo", sessionId: "session-1", channel: "voice", type: "voice.call", operation: "start", outcome: "started" }],
      aggregate: null,
      liveCall: { enabled: true, provider: "realtime", model: "gpt-4o-realtime-preview", startPath: "/t/voice/live" },
    }) });
    render(<DemoPage />);
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    const input = screen.getByLabelText("Destination phone number");
    fireEvent.change(input, { target: { value: "+491701234567" } });
    expect(screen.queryByText("+491701234567")).toBeNull();
    expect(screen.getByText("Live · realtime")).toBeTruthy();
    const start = screen.getByRole("button", { name: "Start protected live call" });
    expect(start.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(start.hasAttribute("disabled")).toBe(false);
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
