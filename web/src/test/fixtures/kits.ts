import type { NewKit } from "@/db/schema";

export const testKits: NewKit[] = [
  {
    id: "test-kit-crm",
    slug: "crm-kit",
    name: "CRM Kit",
    category: "Revenue",
    description: "Full CRM with contacts, deals, pipeline, and proposals",
    correspondingSkillSlug: "client-proposal-skill",
    replaces: "Pipedrive, HubSpot Starter",
    savingsPerMonth: 24,
    dbSchema:
      "contacts (id, name, company, email, phone, source, notes, last_contacted_at, created_at)\ndeals (id, name, contact_id FK, value, currency, stage, notes, expected_close_date, created_at, updated_at)\nactivities (id, contact_id FK, deal_id FK, type, description, created_at)\nproposals (id, deal_id FK, content, version, status, created_at)",
    mcpTools: [
      { name: "add_contact", description: "Add a new contact" },
      { name: "list_contacts", description: "List all contacts" },
      { name: "add_deal", description: "Create a new deal" },
      { name: "pipeline_dashboard", description: "View pipeline overview" },
      { name: "generate_proposal", description: "Generate a proposal for a deal" },
    ],
    mcpApps: [
      { name: "Pipeline Kanban", description: "Visual pipeline board" },
      { name: "Contacts Table", description: "Searchable contacts list" },
      { name: "Dashboard", description: "Deals by stage, value, recent activity" },
    ],
  },
  {
    id: "test-kit-meeting",
    slug: "meeting-action-tracker-kit",
    name: "Meeting Action Tracker Kit",
    category: "Operations",
    description: "Track action items across meetings with persistent history",
    correspondingSkillSlug: "meeting-action-extractor-skill",
    replaces: "Otter.ai, Fireflies, Fathom",
    savingsPerMonth: 19,
    dbSchema:
      "meetings (id, title, date, attendees JSON, raw_notes, created_at)\naction_items (id, meeting_id FK, description, owner, deadline, status, created_at)\ndecisions (id, meeting_id FK, description, created_at)",
    mcpTools: [
      { name: "process_meeting", description: "Extract actions from meeting notes" },
      { name: "list_actions", description: "List action items across meetings" },
      { name: "update_action", description: "Mark action item as done" },
    ],
    mcpApps: [
      { name: "Meeting Summary", description: "Decisions, actions, open questions" },
      { name: "Action Tracker", description: "Cross-meeting action items dashboard" },
    ],
  },
];
