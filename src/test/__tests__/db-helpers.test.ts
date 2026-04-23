import { describe, it, expect } from "vitest";
import { createTestDb, seedTestSkills, seedTestKits, seedAll } from "../db-helpers";
import { skills, kits } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("createTestDb", () => {
  it("creates an in-memory database that accepts queries", async () => {
    const db = await createTestDb();
    const result = await db.select().from(skills);
    expect(result).toEqual([]);
  });

  it("creates both skills and kits tables", async () => {
    const db = await createTestDb();
    const skillResult = await db.select().from(skills);
    const kitResult = await db.select().from(kits);
    expect(skillResult).toEqual([]);
    expect(kitResult).toEqual([]);
  });
});

describe("seedTestSkills", () => {
  it("inserts test skill fixtures", async () => {
    const db = await createTestDb();
    await seedTestSkills(db);
    const allSkills = await db.select().from(skills);
    expect(allSkills).toHaveLength(3);
  });

  it("inserts skills with correct JSON fields", async () => {
    const db = await createTestDb();
    await seedTestSkills(db);
    const result = await db.select().from(skills).where(eq(skills.slug, "client-proposal-skill"));
    const skill = result[0];
    expect(skill.tags).toEqual(["freelancer", "consultant"]);
    expect(skill.whatsInside).toBeInstanceOf(Array);
    expect(skill.composition.skillMd).toBe(true);
  });
});

describe("seedTestKits", () => {
  it("inserts test kit fixtures", async () => {
    const db = await createTestDb();
    await seedTestKits(db);
    const allKits = await db.select().from(kits);
    expect(allKits).toHaveLength(2);
  });

  it("inserts kits with correct JSON fields", async () => {
    const db = await createTestDb();
    await seedTestKits(db);
    const result = await db.select().from(kits).where(eq(kits.slug, "crm-kit"));
    const kit = result[0];
    expect(kit.mcpTools).toBeInstanceOf(Array);
    expect(kit.mcpApps).toBeInstanceOf(Array);
    expect(kit.correspondingSkillSlug).toBe("client-proposal-skill");
  });
});

describe("seedAll", () => {
  it("seeds both skills and kits", async () => {
    const db = await createTestDb();
    await seedAll(db);
    const allSkills = await db.select().from(skills);
    const allKits = await db.select().from(kits);
    expect(allSkills).toHaveLength(3);
    expect(allKits).toHaveLength(2);
  });
});
