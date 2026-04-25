import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestSkills } from "@/test/db-helpers";

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
  await seedTestSkills(db);
});

describe("GET /api/skills", () => {
  it("returns all skills", async () => {
    const request = new NextRequest("http://localhost/api/skills");
    const response = await GET(request);
    const data = await response.json();

    expect(data.skills).toHaveLength(3);
  });

  it("filters by category", async () => {
    const request = new NextRequest("http://localhost/api/skills?category=Legal");
    const response = await GET(request);
    const data = await response.json();

    expect(data.skills).toHaveLength(1);
    expect(data.skills[0].slug).toBe("contract-red-flag-skill");
  });

  it("returns empty array for unknown category", async () => {
    const request = new NextRequest("http://localhost/api/skills?category=Unknown");
    const response = await GET(request);
    const data = await response.json();

    expect(data.skills).toHaveLength(0);
  });
});
