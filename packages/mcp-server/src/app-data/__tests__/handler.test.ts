import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../framework/app-token", () => ({
  verifyAppToken: vi.fn(),
}));

vi.mock("../../framework/dynamo", () => ({
  getUserKitDb: vi.fn(),
}));

vi.mock("../../framework/kit-db", () => ({
  createKitDbClient: vi.fn(),
}));

import { handler } from "../handler";
import { verifyAppToken } from "../../router/app-token";
import { getUserKitDb } from "../../db/dynamo";
import { createKitDbClient } from "../../db/kit-db";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

function makeEvent(params: Record<string, string> = {}): APIGatewayProxyEventV2 {
  return {
    requestContext: { http: { method: "GET" } } as any,
    queryStringParameters: params,
    headers: {},
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App Data handler", () => {
  it("returns 401 if no token provided", async () => {
    const res = await handler(makeEvent({ view: "meetings" }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    vi.mocked(verifyAppToken).mockRejectedValueOnce(new Error("expired"));
    const res = await handler(makeEvent({ token: "bad-token", view: "meetings" }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 if kit not activated", async () => {
    vi.mocked(verifyAppToken).mockResolvedValueOnce({ sub: "user-1", kit: "meeting" });
    vi.mocked(getUserKitDb).mockResolvedValueOnce(null);
    const res = await handler(makeEvent({ token: "valid", view: "meetings" }));
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for unknown view", async () => {
    vi.mocked(verifyAppToken).mockResolvedValueOnce({ sub: "user-1", kit: "meeting" });
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01",
    });
    vi.mocked(createKitDbClient).mockReturnValueOnce({ all: vi.fn() } as any);

    const res = await handler(makeEvent({ token: "valid", view: "evil_table" }));
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 if view param missing", async () => {
    vi.mocked(verifyAppToken).mockResolvedValueOnce({ sub: "user-1", kit: "meeting" });
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01",
    });

    const res = await handler(makeEvent({ token: "valid" }));
    expect(res.statusCode).toBe(400);
  });

  it("returns data for a valid request", async () => {
    vi.mocked(verifyAppToken).mockResolvedValueOnce({ sub: "user-1", kit: "meeting" });
    vi.mocked(getUserKitDb).mockResolvedValueOnce({
      userId: "user-1",
      kitId: "meeting",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01",
    });
    const mockDb = {
      all: vi.fn().mockResolvedValueOnce({
        rows: [{ id: "1", title: "Sprint Planning" }],
      }),
    };
    vi.mocked(createKitDbClient).mockReturnValueOnce(mockDb as any);

    const res = await handler(makeEvent({ token: "valid", view: "meetings" }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body!);
    expect(body.kit).toBe("meeting");
    expect(body.view).toBe("meetings");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Sprint Planning");
  });
});
