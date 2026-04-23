import { describe, it, expect } from "vitest";
import {
  generateSkillMetadata,
  generateSkillJsonLd,
  generateKitMetadata,
  generateKitJsonLd,
} from "../seo.service";
import type { Skill, Kit } from "@/db/schema";

const mockSkill: Skill = {
  id: "s1",
  slug: "client-proposal-skill",
  name: "Client Proposal Skill",
  category: "Revenue",
  description: "Generate complete, professional proposals",
  upgradeHook: "Can't remember past proposals or track win rates",
  tags: ["freelancer"],
  compatibility: ["claude.ai", "Claude Desktop", "Cowork"],
  exampleInput: "Write a proposal...",
  exampleOutput: "# Proposal\n...",
  whatsInside: [{ file: "SKILL.md", description: "Core" }],
  composition: { skillMd: true, references: 3, examples: 3, templates: 1, scripts: 0, agents: 0 },
  s3Key: "skills/client-proposal-skill.zip",
  downloadCount: 42,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockKit: Kit = {
  id: "k1",
  slug: "crm-kit",
  name: "CRM Kit",
  category: "Revenue",
  description: "Full CRM with contacts, deals, pipeline, and proposals",
  correspondingSkillSlug: "client-proposal-skill",
  replaces: "Pipedrive, HubSpot Starter",
  savingsPerMonth: 24,
  dbSchema: "contacts (...)\ndeals (...)",
  mcpTools: [{ name: "add_contact", description: "Add a contact" }],
  mcpApps: [{ name: "Pipeline", description: "Kanban board" }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("generateSkillMetadata", () => {
  it("generates correct title with 'Free'", () => {
    const meta = generateSkillMetadata(mockSkill);
    expect(meta.title).toBe("Client Proposal Skill — Free Claude Skill");
  });

  it("includes compatibility in description", () => {
    const meta = generateSkillMetadata(mockSkill);
    expect(meta.description).toContain("claude.ai");
  });

  it("sets correct canonical URL", () => {
    const meta = generateSkillMetadata(mockSkill);
    const og = meta.openGraph as any;
    expect(og.url).toBe("https://kitstack.co/skills/client-proposal-skill");
  });
});

describe("generateSkillJsonLd", () => {
  it("returns SoftwareApplication schema", () => {
    const jsonLd = generateSkillJsonLd(mockSkill);
    expect(jsonLd["@type"]).toBe("SoftwareApplication");
  });

  it("has free price", () => {
    const jsonLd = generateSkillJsonLd(mockSkill);
    expect(jsonLd.offers.price).toBe("0");
  });
});

describe("generateKitMetadata", () => {
  it("generates correct title with replaces", () => {
    const meta = generateKitMetadata(mockKit);
    expect(meta.title).toBe("CRM Kit — Replace Pipedrive, HubSpot Starter");
  });

  it("includes savings in description", () => {
    const meta = generateKitMetadata(mockKit);
    expect(meta.description).toContain("€24/mo");
  });

  it("includes subscription price in description", () => {
    const meta = generateKitMetadata(mockKit);
    expect(meta.description).toContain("€5/mo");
  });

  it("sets correct canonical URL", () => {
    const meta = generateKitMetadata(mockKit);
    const og = meta.openGraph as any;
    expect(og.url).toBe("https://kitstack.co/kits/crm-kit");
  });
});

describe("generateKitJsonLd", () => {
  it("returns Product schema", () => {
    const jsonLd = generateKitJsonLd(mockKit);
    expect(jsonLd["@type"]).toBe("Product");
  });

  it("has subscription price of €5", () => {
    const jsonLd = generateKitJsonLd(mockKit);
    expect(jsonLd.offers.price).toBe("5.00");
  });

  it("includes category", () => {
    const jsonLd = generateKitJsonLd(mockKit);
    expect(jsonLd.category).toBe("Revenue");
  });
});
