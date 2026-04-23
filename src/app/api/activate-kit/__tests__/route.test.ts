import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../../../../packages/mcp-server/src/framework/dynamo", () => ({
  getUserKitDb: vi.fn(),
  putUserKitDb: vi.fn(),
}));

vi.mock("../../../../../packages/mcp-server/src/framework/db-provisioner", () => ({
  provisionKitDatabase: vi.fn(),
}));

import { POST } from "../route";
import { getUserKitDb } from "../../../../../packages/mcp-server/src/framework/dynamo";
import { provisionKitDatabase } from "../../../../../packages/mcp-server/src/framework/db-provisioner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/activate-kit", () => {
  it("returns 400 if kitId or userId missing", async () => {
    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitId: "crm" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns already_active if kit is already provisioned", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting-action-tracker",
      dbUrl: "libsql://existing.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-04-01T00:00:00Z",
    });

    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitId: "meeting-action-tracker", userId: "user-1" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("already_active");
    expect(provisionKitDatabase).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown kit", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitId: "nonexistent-kit", userId: "user-1" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("provisions a new kit database", async () => {
    vi.mocked(getUserKitDb).mockResolvedValueOnce(null);
    vi.mocked(provisionKitDatabase).mockResolvedValueOnce({
      dbUrl: "libsql://new.turso.io",
      dbToken: "new-tok",
    });

    const request = new NextRequest("http://localhost/api/activate-kit", {
      method: "POST",
      body: JSON.stringify({ kitId: "meeting-action-tracker", userId: "user-1" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("activated");
    expect(provisionKitDatabase).toHaveBeenCalledWith(
      "user-1",
      "meeting-action-tracker",
      expect.stringContaining("CREATE TABLE")
    );
  });
});
