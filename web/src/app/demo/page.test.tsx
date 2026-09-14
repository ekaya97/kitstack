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
    json: async () => ({ events: [], aggregate: { totalEvents: 0, totalRequestTokens: 0, totalResponseTokens: 0, totalEstimatedCostUsd: 0, totalLatencyMs: 0, successCount: 0, errorCount: 0 } }),
  });
});

describe("demo observability page", () => {
  it("loads with the three observability views and empty state", async () => {
    render(<DemoPage />);
    expect(screen.getByText("Developer observability")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("No apps in this browser session")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Usage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Session Trace" })).toBeTruthy();
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
