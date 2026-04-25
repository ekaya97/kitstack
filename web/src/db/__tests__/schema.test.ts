import { describe, it, expect } from "vitest";
import { createTestDb, seedTestSkills, seedTestKits } from "@/test/db-helpers";
import { skills, kits, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("skills table", () => {
  it("enforces unique slug constraint", async () => {
    const db = await createTestDb();
    const base = {
      id: "s1",
      slug: "dup-slug",
      name: "Skill 1",
      category: "Revenue" as const,
      description: "Test",
      tags: ["test"],
      compatibility: ["claude.ai"],
      exampleInput: "in",
      exampleOutput: "out",
      whatsInside: [{ file: "SKILL.md", description: "Core" }],
      composition: { skillMd: true, references: 0, examples: 0, templates: 0, scripts: 0, agents: 0 },
    };
    await db.insert(skills).values(base);
    await expect(db.insert(skills).values({ ...base, id: "s2" })).rejects.toThrow();
  });

  it("stores and retrieves JSON fields correctly", async () => {
    const db = await createTestDb();
    const tags = ["a", "b", "c"];
    const whatsInside = [{ file: "SKILL.md", description: "Core" }];
    await db.insert(skills).values({
      id: "json-test",
      slug: "json-skill",
      name: "JSON Skill",
      category: "Sales",
      description: "Test",
      tags,
      compatibility: ["claude.ai"],
      exampleInput: "in",
      exampleOutput: "out",
      whatsInside,
      composition: { skillMd: true, references: 1, examples: 1, templates: 0, scripts: 0, agents: 0 },
    });
    const result = await db.select().from(skills).where(eq(skills.id, "json-test"));
    expect(result[0].tags).toEqual(tags);
    expect(result[0].whatsInside).toEqual(whatsInside);
  });

  it("defaults downloadCount to 0", async () => {
    const db = await createTestDb();
    await db.insert(skills).values({
      id: "dl-test",
      slug: "dl-skill",
      name: "DL Skill",
      category: "Marketing",
      description: "Test",
      tags: [],
      compatibility: [],
      exampleInput: "in",
      exampleOutput: "out",
      whatsInside: [],
      composition: { skillMd: true, references: 0, examples: 0, templates: 0, scripts: 0, agents: 0 },
    });
    const result = await db.select().from(skills).where(eq(skills.id, "dl-test"));
    expect(result[0].downloadCount).toBe(0);
  });
});

describe("kits table", () => {
  it("enforces unique slug constraint", async () => {
    const db = await createTestDb();
    const base = {
      id: "k1",
      slug: "dup-kit",
      name: "Kit 1",
      category: "Revenue" as const,
      description: "Test",
      replaces: "Nothing",
      savingsPerMonth: 10,
    };
    await db.insert(kits).values(base);
    await expect(db.insert(kits).values({ ...base, id: "k2" })).rejects.toThrow();
  });

  it("stores mcpTools and mcpApps as JSON", async () => {
    const db = await createTestDb();
    const tools = [{ name: "add_contact", description: "Add a contact" }];
    const apps = [{ name: "Dashboard", description: "Overview" }];
    await db.insert(kits).values({
      id: "json-kit",
      slug: "json-kit",
      name: "JSON Kit",
      category: "Sales",
      description: "Test",
      replaces: "Nothing",
      savingsPerMonth: 20,
      mcpTools: tools,
      mcpApps: apps,
    });
    const result = await db.select().from(kits).where(eq(kits.id, "json-kit"));
    expect(result[0].mcpTools).toEqual(tools);
    expect(result[0].mcpApps).toEqual(apps);
  });

  it("allows correspondingSkillSlug to be null", async () => {
    const db = await createTestDb();
    await db.insert(kits).values({
      id: "no-skill",
      slug: "standalone-kit",
      name: "Standalone",
      category: "Operations",
      description: "Test",
      replaces: "Nothing",
      savingsPerMonth: 5,
    });
    const result = await db.select().from(kits).where(eq(kits.id, "no-skill"));
    expect(result[0].correspondingSkillSlug).toBeNull();
  });
});

describe("subscriptions table", () => {
  it("inserts a subscription", async () => {
    const db = await createTestDb();
    await db.insert(subscriptions).values({
      id: "sub-1",
      userId: "user-1",
      plan: "starter",
      status: "active",
    });
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, "sub-1"));
    expect(result).toHaveLength(1);
    expect(result[0].plan).toBe("starter");
    expect(result[0].status).toBe("active");
  });
});
