import type { NewSkill } from "@/db/schema";

const baseCompatibility = ["claude.ai", "Claude Desktop", "Cowork", "Claude Code"];

export const testSkills: NewSkill[] = [
  {
    id: "test-skill-proposal",
    slug: "client-proposal-skill",
    name: "Client Proposal Skill",
    category: "Revenue",
    description: "Generate complete, professional proposals from a brief description",
    upgradeHook: "Great proposals, but can't remember past proposals or track win rates",
    tags: ["freelancer", "consultant"],
    compatibility: baseCompatibility,
    exampleInput: "Write a proposal for a 3-month brand strategy project",
    exampleOutput: "# Brand Strategy Proposal\n\n## Executive Summary\n...",
    whatsInside: [
      { file: "SKILL.md", description: "Core methodology & output rules" },
      { file: "references/pricing-frameworks.md", description: "Pricing models" },
    ],
    composition: { skillMd: true, references: 3, examples: 3, templates: 1, scripts: 0, agents: 0 },
    s3Key: "skills/client-proposal-skill.zip",
  },
  {
    id: "test-skill-contract",
    slug: "contract-red-flag-skill",
    name: "Contract Red Flag Skill",
    category: "Legal",
    description: "Scan contracts for problematic clauses with risk scoring",
    upgradeHook: "Good scan, but can't compare this contract to the last three you signed",
    tags: ["freelancer", "founder"],
    compatibility: baseCompatibility,
    exampleInput: "Review this freelance contract for red flags",
    exampleOutput: "# Contract Analysis\n\n## Risk Summary\n...",
    whatsInside: [
      { file: "SKILL.md", description: "Scanning methodology" },
      { file: "references/red-flag-catalogue.md", description: "30+ problematic patterns" },
    ],
    composition: { skillMd: true, references: 4, examples: 2, templates: 0, scripts: 0, agents: 1 },
    s3Key: "skills/contract-red-flag-skill.zip",
  },
  {
    id: "test-skill-outreach",
    slug: "cold-email-sequence-skill",
    name: "Cold Email Sequence Skill",
    category: "Sales",
    description: "Write personalized cold email sequences that get replies",
    upgradeHook: "Great sequences, but can't save templates or track prospects",
    tags: ["founder", "sales"],
    compatibility: baseCompatibility,
    exampleInput: "Create a 4-email cold outreach sequence for my consulting firm",
    exampleOutput: "# Cold Outreach Sequence\n\n## Email 1: Initial Contact\n...",
    whatsInside: [
      { file: "SKILL.md", description: "Sequence construction logic" },
    ],
    composition: { skillMd: true, references: 3, examples: 3, templates: 0, scripts: 0, agents: 1 },
    s3Key: "skills/cold-email-sequence-skill.zip",
  },
];
