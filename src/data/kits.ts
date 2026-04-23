export interface Skill {
  slug: string;
  name: string;
  cat: string;
  desc: string;
  files: number;
  size: string;
  upgradeTo: string | null;
  upgradeHook: string;
  author: string;
  downloads: number;
  rating: number;
  reviews: number;
}

export interface Kit {
  slug: string;
  name: string;
  cat: string;
  tagline: string;
  desc: string;
  replaces: string[];
  replacesValue: number;
  schema: string[];
  tools: string[];
  uiComponents: string[];
  fromSkill: string;
  author: string;
  subscribers: number;
  rating: number;
  reviews: number;
  status: string;
}

export const SKILLS: Skill[] = [
  {
    slug: "client-proposal-skill",
    name: "Client Proposal Skill",
    cat: "Revenue",
    desc: "Turn a 4-line brief into a complete proposal: exec summary, phased scope, pricing table, terms.",
    files: 7,
    size: "18 KB",
    upgradeTo: "crm-kit",
    upgradeHook:
      "Track past proposals, measure win rate, manage clients.",
    author: "kitstack",
    downloads: 3280,
    rating: 4.9,
    reviews: 142,
  },
  {
    slug: "contract-red-flag-skill",
    name: "Contract Red Flag Skill",
    cat: "Legal",
    desc: "Clause-by-clause scan. Risk scores, plain-language explanations, suggested redlines.",
    files: 8,
    size: "22 KB",
    upgradeTo: null,
    upgradeHook:
      "Compare this contract to the last three you signed.",
    author: "kitstack",
    downloads: 1940,
    rating: 4.8,
    reviews: 98,
  },
  {
    slug: "cold-email-sequence-skill",
    name: "Cold Email Sequence Skill",
    cat: "Sales",
    desc: "3\u20135 email cadences. Personalization hooks baked in. Human tone, not corporate.",
    files: 8,
    size: "16 KB",
    upgradeTo: "outreach-kit",
    upgradeHook:
      "Save templates, track prospects, reuse personalization.",
    author: "kitstack",
    downloads: 2610,
    rating: 4.8,
    reviews: 120,
  },
  {
    slug: "linkedin-content-skill",
    name: "LinkedIn Content Skill",
    cat: "Marketing",
    desc: "Voice-calibrated posts. 8 frameworks. Anti-slop ruleset baked in.",
    files: 9,
    size: "24 KB",
    upgradeTo: null,
    upgradeHook:
      "Remember your voice, plan a calendar, track what worked.",
    author: "kitstack",
    downloads: 4120,
    rating: 4.9,
    reviews: 210,
  },
  {
    slug: "meeting-action-extractor-skill",
    name: "Meeting Action Extractor Skill",
    cat: "Ops",
    desc: "Messy notes \u2192 action items with owners and deadlines. Four output formats.",
    files: 5,
    size: "10 KB",
    upgradeTo: "meeting-kit",
    upgradeHook:
      "Track action items across meetings, see overdue items.",
    author: "kitstack",
    downloads: 5340,
    rating: 4.7,
    reviews: 315,
  },
  {
    slug: "expense-categorizer-skill",
    name: "Expense Categorizer Skill",
    cat: "Finance",
    desc: "German Steuerberater-ready: SKR03/04 mapping, VAT decision tree.",
    files: 9,
    size: "20 KB",
    upgradeTo: "expense-kit",
    upgradeHook:
      "Track expenses across months, quarterly summaries, receipt OCR.",
    author: "kitstack",
    downloads: 1520,
    rating: 4.7,
    reviews: 74,
  },
];

export const KITS: Kit[] = [
  {
    slug: "crm-kit",
    name: "CRM Kit",
    cat: "Revenue",
    tagline: "A real CRM that lives inside your Claude chat.",
    desc: "Contacts, deals, pipeline, proposals. Every conversation adds to the record.",
    replaces: ["Pipedrive \u20ac24", "HubSpot Starter \u20ac20"],
    replacesValue: 44,
    schema: ["contacts", "deals", "activities", "proposals"],
    tools: [
      "add_contact",
      "list_contacts",
      "search_contacts",
      "add_deal",
      "update_deal",
      "add_activity",
      "pipeline_dashboard",
      "generate_proposal",
      "export",
    ],
    uiComponents: [
      "Pipeline kanban",
      "Contacts table",
      "Contact detail",
      "Dashboard",
      "Proposal preview",
    ],
    fromSkill: "client-proposal-skill",
    author: "kitstack",
    subscribers: 420,
    rating: 4.8,
    reviews: 64,
    status: "live",
  },
  {
    slug: "expense-kit",
    name: "Expense & Tax Prep Kit",
    cat: "Finance",
    tagline: "German tax prep that remembers the year.",
    desc: "Categorize expenses with SKR03/04. Quarterly summaries. Steuerberater-ready export.",
    replaces: ["Lexoffice \u20ac14", "sevDesk \u20ac18"],
    replacesValue: 32,
    schema: ["expenses", "quarterly_summaries", "settings"],
    tools: [
      "add_expense",
      "import_csv",
      "list_expenses",
      "categorize",
      "quarterly_summary",
      "export_steuerberater",
    ],
    uiComponents: [
      "Expense table",
      "Category dashboard",
      "Import review",
      "Steuerberater export",
    ],
    fromSkill: "expense-categorizer-skill",
    author: "kitstack",
    subscribers: 280,
    rating: 4.9,
    reviews: 38,
    status: "live",
  },
  {
    slug: "outreach-kit",
    name: "Cold Outreach Kit",
    cat: "Sales",
    tagline: "Sequences that remember who you've written to.",
    desc: "Build email sequences, manage prospects, track personalization hooks.",
    replaces: ["Lavender \u20ac29", "Instantly \u20ac37"],
    replacesValue: 66,
    schema: ["sequences", "emails", "prospects"],
    tools: [
      "create_sequence",
      "generate_emails",
      "list_sequences",
      "add_prospect",
      "personalize_for_prospect",
      "export_sequence",
    ],
    uiComponents: [
      "Sequence builder",
      "Prospect list",
      "Email preview",
      "Personalization panel",
    ],
    fromSkill: "cold-email-sequence-skill",
    author: "kitstack",
    subscribers: 190,
    rating: 4.7,
    reviews: 24,
    status: "live",
  },
  {
    slug: "meeting-kit",
    name: "Meeting Action Tracker Kit",
    cat: "Ops",
    tagline: "Action items that survive past the meeting.",
    desc: "Extract, assign, and track action items across every meeting, forever.",
    replaces: ["Otter.ai $17", "Fireflies $19"],
    replacesValue: 36,
    schema: ["meetings", "action_items", "decisions"],
    tools: [
      "process_meeting",
      "list_meetings",
      "get_meeting",
      "list_actions",
      "update_action",
      "open_items_summary",
    ],
    uiComponents: [
      "Meeting summary",
      "Action tracker",
      "Meeting history",
      "Open items",
    ],
    fromSkill: "meeting-action-extractor-skill",
    author: "kitstack",
    subscribers: 340,
    rating: 4.8,
    reviews: 52,
    status: "live",
  },
];

export function findSkill(slug: string) {
  return SKILLS.find((s) => s.slug === slug);
}

export function findKit(slug: string) {
  return KITS.find((k) => k.slug === slug);
}
