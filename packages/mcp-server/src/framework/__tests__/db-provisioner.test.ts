import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sst", () => ({
  Resource: { App: { stage: "production" } },
}));

vi.mock("../dynamo", () => ({
  putUserKitDb: vi.fn(),
}));

vi.mock("@libsql/client", () => ({
  createClient: vi.fn().mockReturnValue({
    execute: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { provisionKitDatabase } from "../db-provisioner";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TURSO_PLATFORM_API_TOKEN", "test-turso-token");
  vi.stubEnv("TURSO_ORG_NAME", "test-org");
});

describe("provisionKitDatabase", () => {
  it("creates a database and returns URL + token", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          database: { hostname: "ks-user1-crm.turso.io" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: "db-token-123" }),
      });

    const result = await provisionKitDatabase(
      "user1",
      "crm",
      "CREATE TABLE contacts (id TEXT PRIMARY KEY);"
    );

    expect(result.dbUrl).toBe("libsql://ks-user1-crm.turso.io");
    expect(result.dbToken).toBe("db-token-123");
  });

  it("calls Turso API with correct org and db name", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          database: { hostname: "test.turso.io" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: "token" }),
      });

    await provisionKitDatabase("user1", "crm", "SELECT 1;");

    const [createCall] = mockFetch.mock.calls;
    expect(createCall[0]).toContain("/organizations/test-org/databases");
    const body = JSON.parse(createCall[1].body);
    expect(body.name).toBe("ks-user1-crm");
  });

  it("throws on Turso API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad request",
    });

    await expect(
      provisionKitDatabase("user1", "crm", "SELECT 1;")
    ).rejects.toThrow("Turso API error (400)");
  });

  it("throws if env vars are missing", async () => {
    vi.stubEnv("TURSO_PLATFORM_API_TOKEN", "");
    await expect(
      provisionKitDatabase("user1", "crm", "SELECT 1;")
    ).rejects.toThrow("TURSO_PLATFORM_API_TOKEN");
  });

  it("stores mapping in DynamoDB", async () => {
    const { putUserKitDb } = await import("../dynamo");

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          database: { hostname: "test.turso.io" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: "token" }),
      });

    await provisionKitDatabase("user1", "crm", "SELECT 1;");

    expect(putUserKitDb).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        kitId: "crm",
        dbUrl: "libsql://test.turso.io",
        dbToken: "token",
      })
    );
  });
});
