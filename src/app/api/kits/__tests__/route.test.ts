import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestKits } from "@/test/db-helpers";

let db: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

beforeEach(async () => {
  db = await createTestDb();
  await seedTestKits(db);
});

describe("GET /api/kits", () => {
  it("returns all kits", async () => {
    const request = new NextRequest("http://localhost/api/kits");
    const response = await GET(request);
    const data = await response.json();

    expect(data.kits).toHaveLength(2);
  });

  it("filters by category", async () => {
    const request = new NextRequest("http://localhost/api/kits?category=Operations");
    const response = await GET(request);
    const data = await response.json();

    expect(data.kits).toHaveLength(1);
    expect(data.kits[0].slug).toBe("meeting-action-tracker-kit");
  });

  it("returns empty array for unknown category", async () => {
    const request = new NextRequest("http://localhost/api/kits?category=Unknown");
    const response = await GET(request);
    const data = await response.json();

    expect(data.kits).toHaveLength(0);
  });
});
