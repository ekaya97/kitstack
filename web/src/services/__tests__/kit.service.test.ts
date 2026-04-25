import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestKits } from "@/test/db-helpers";
import { getAllKits, getKitsByCategory, getKitBySlug } from "../kit.service";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  await seedTestKits(db);
});

describe("getAllKits", () => {
  it("returns all kits", async () => {
    const result = await getAllKits();
    expect(result).toHaveLength(2);
  });

  it("returns kits ordered by name", async () => {
    const result = await getAllKits();
    const names = result.map((k) => k.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("getKitsByCategory", () => {
  it("returns kits matching the category", async () => {
    const result = await getKitsByCategory("Revenue");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("crm-kit");
  });

  it("returns empty array for nonexistent category", async () => {
    const result = await getKitsByCategory("Nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("getKitBySlug", () => {
  it("returns the correct kit", async () => {
    const result = await getKitBySlug("crm-kit");
    expect(result).toBeDefined();
    expect(result!.name).toBe("CRM Kit");
    expect(result!.correspondingSkillSlug).toBe("client-proposal-skill");
  });

  it("returns undefined for nonexistent slug", async () => {
    const result = await getKitBySlug("nope");
    expect(result).toBeUndefined();
  });
});
