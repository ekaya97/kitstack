import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});

vi.mock("@/lib/authz", () => ({
  requireAuthorized: vi.fn(async () => ({ ok: true, userId: "user-1", userName: "Test User" })),
}));

vi.mock("@kitstackco/mcp-server/db/dynamo", () => ({
  getUserKitDb: vi.fn(),
  putUserKitDb: vi.fn(),
}));

vi.mock("@kitstackco/mcp-server/db/provisioner", () => ({
  provisionKitDatabase: vi.fn(),
}));

vi.mock("@/services/kit-lifecycle.service", () => ({
  activateKit: vi.fn(),
}));

import { POST } from "../route";
import { getUserKitDb } from "@kitstackco/mcp-server/db/dynamo";
import { provisionKitDatabase } from "@kitstackco/mcp-server/db/provisioner";
import { activateKit } from "@/services/kit-lifecycle.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/activate-kit", () => {
  it("returns 400 if kitId or userId missing", async () => {
    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns already_active if kit is already provisioned", async () => {
    vi.mocked(activateKit).mockResolvedValueOnce({ ok: true, data: { status: "already_active" } });
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting-action-tracker",
      dbUrl: "libsql://existing.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-04-01T00:00:00Z",
    });

    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitSlug: "meeting-action-tracker-kit" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("already_active");
    expect(provisionKitDatabase).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown kit", async () => {
    vi.mocked(activateKit).mockResolvedValueOnce({ ok: false, status: 404, error: "Unknown kit" });
    vi.mocked(getUserKitDb).mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitSlug: "nonexistent-kit" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("provisions a new kit database", async () => {
    vi.mocked(activateKit).mockResolvedValueOnce({ ok: true, data: { status: "activated" } });
    vi.mocked(getUserKitDb).mockResolvedValueOnce(null);
    vi.mocked(provisionKitDatabase).mockResolvedValueOnce({
      dbUrl: "libsql://new.turso.io",
      dbToken: "new-tok",
    });

    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitSlug: "meeting-action-tracker-kit" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("activated");
    expect(activateKit).toHaveBeenCalledWith("user-1", "meeting-action-tracker-kit");
  });
});
