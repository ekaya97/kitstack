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

describe("GET /api/skills/[slug]", () => {
  it("returns a skill for a valid slug", async () => {
    const request = new NextRequest("http://localhost/api/skills/client-proposal-skill");
    const params = Promise.resolve({ slug: "client-proposal-skill" });
    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Client Proposal Skill");
    expect(data.upgradeHook).toContain("past proposals");
  });

  it("returns 404 for nonexistent slug", async () => {
    const request = new NextRequest("http://localhost/api/skills/nope");
    const params = Promise.resolve({ slug: "nope" });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
  });
});
