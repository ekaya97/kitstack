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

describe("GET /api/kits/[slug]", () => {
  it("returns a kit for a valid slug", async () => {
    const request = new NextRequest("http://localhost/api/kits/crm-kit");
    const params = Promise.resolve({ slug: "crm-kit" });
    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("CRM Kit");
    expect(data.correspondingSkillSlug).toBe("client-proposal-skill");
    expect(data.mcpTools).toBeInstanceOf(Array);
  });

  it("returns 404 for nonexistent slug", async () => {
    const request = new NextRequest("http://localhost/api/kits/nope");
    const params = Promise.resolve({ slug: "nope" });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
  });
});
