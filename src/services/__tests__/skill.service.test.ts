import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestSkills } from "@/test/db-helpers";
import { skills } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getAllSkills,
  getSkillsByCategory,
  getSkillBySlug,
  incrementDownloadCount,
} from "../skill.service";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  await seedTestSkills(db);
});

describe("getAllSkills", () => {
  it("returns all skills", async () => {
    const result = await getAllSkills(db);
    expect(result).toHaveLength(3);
  });

  it("returns skills ordered by name", async () => {
    const result = await getAllSkills(db);
    const names = result.map((s) => s.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("getSkillsByCategory", () => {
  it("returns skills matching the category", async () => {
    const result = await getSkillsByCategory(db, "Revenue");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("client-proposal-skill");
  });

  it("returns empty array for nonexistent category", async () => {
    const result = await getSkillsByCategory(db, "Nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("getSkillBySlug", () => {
  it("returns the correct skill", async () => {
    const result = await getSkillBySlug(db, "contract-red-flag-skill");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Contract Red Flag Skill");
  });

  it("returns undefined for nonexistent slug", async () => {
    const result = await getSkillBySlug(db, "nope");
    expect(result).toBeUndefined();
  });
});

describe("incrementDownloadCount", () => {
  it("increments download count by 1", async () => {
    await incrementDownloadCount(db, "client-proposal-skill");
    const result = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, "client-proposal-skill"));
    expect(result[0].downloadCount).toBe(1);
  });

  it("increments multiple times", async () => {
    await incrementDownloadCount(db, "client-proposal-skill");
    await incrementDownloadCount(db, "client-proposal-skill");
    await incrementDownloadCount(db, "client-proposal-skill");
    const result = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, "client-proposal-skill"));
    expect(result[0].downloadCount).toBe(3);
  });
});
