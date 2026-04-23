import { describe, it, expect } from "vitest";
import { seedSkills, seedKits } from "../seed-data";

const validCategories = ["Revenue", "Legal", "Finance", "Sales", "Marketing", "Operations"];

describe("seed skills", () => {
  it("contains 6 skills", () => {
    expect(seedSkills).toHaveLength(6);
  });

  it("has unique slugs", () => {
    const slugs = seedSkills.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique ids", () => {
    const ids = seedSkills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has valid categories", () => {
    for (const skill of seedSkills) {
      expect(validCategories).toContain(skill.category);
    }
  });

  it("has descriptions under 120 characters", () => {
    for (const skill of seedSkills) {
      expect(skill.description.length).toBeLessThanOrEqual(120);
    }
  });

  it("has non-empty exampleInput and exampleOutput", () => {
    for (const skill of seedSkills) {
      expect(skill.exampleInput.length).toBeGreaterThan(0);
      expect(skill.exampleOutput.length).toBeGreaterThan(0);
    }
  });

  it("has non-empty whatsInside", () => {
    for (const skill of seedSkills) {
      expect((skill.whatsInside as any[]).length).toBeGreaterThan(0);
    }
  });

  it("has s3Key starting with skills/", () => {
    for (const skill of seedSkills) {
      expect(skill.s3Key).toBeDefined();
      expect(skill.s3Key!.startsWith("skills/")).toBe(true);
    }
  });

  it("has upgradeHook for every skill", () => {
    for (const skill of seedSkills) {
      expect(skill.upgradeHook).toBeDefined();
      expect(skill.upgradeHook!.length).toBeGreaterThan(0);
    }
  });
});

describe("seed kits", () => {
  it("contains 4 kits", () => {
    expect(seedKits).toHaveLength(4);
  });

  it("has unique slugs", () => {
    const slugs = seedKits.map((k) => k.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique ids", () => {
    const ids = seedKits.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has valid categories", () => {
    for (const kit of seedKits) {
      expect(validCategories).toContain(kit.category);
    }
  });

  it("has descriptions under 120 characters", () => {
    for (const kit of seedKits) {
      expect(kit.description.length).toBeLessThanOrEqual(120);
    }
  });

  it("has positive savingsPerMonth", () => {
    for (const kit of seedKits) {
      expect(kit.savingsPerMonth).toBeGreaterThan(0);
    }
  });

  it("has correspondingSkillSlug for every kit", () => {
    for (const kit of seedKits) {
      expect(kit.correspondingSkillSlug).toBeDefined();
      expect(kit.correspondingSkillSlug!.length).toBeGreaterThan(0);
    }
  });

  it("correspondingSkillSlug references an existing skill", () => {
    const skillSlugs = seedSkills.map((s) => s.slug);
    for (const kit of seedKits) {
      expect(skillSlugs).toContain(kit.correspondingSkillSlug);
    }
  });

  it("has mcpTools for every kit", () => {
    for (const kit of seedKits) {
      expect(kit.mcpTools).toBeDefined();
      expect((kit.mcpTools as any[]).length).toBeGreaterThan(0);
    }
  });

  it("has mcpApps for every kit", () => {
    for (const kit of seedKits) {
      expect(kit.mcpApps).toBeDefined();
      expect((kit.mcpApps as any[]).length).toBeGreaterThan(0);
    }
  });

  it("has dbSchema for every kit", () => {
    for (const kit of seedKits) {
      expect(kit.dbSchema).toBeDefined();
      expect(kit.dbSchema!.length).toBeGreaterThan(0);
    }
  });
});
