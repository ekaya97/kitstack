/**
 * Type validation file — NOT a runtime test.
 * If `tsc --noEmit` passes on this file, the SDK type flow works end-to-end.
 */

import type { LoaderData, KitToolResult, KitDefinition } from "@kitstack/sdk";

// --- 1. Validate kit.config.ts produces KitDefinition ---

import kit from "../kit.config";
const _kitDef: KitDefinition = kit;

// --- 2. Validate LoaderData extracts the correct type from views ---

import contactsView from "../src/views/contacts";
import contactDetailView from "../src/views/contact-detail";
import pipelineView from "../src/views/pipeline";
import dashboardView from "../src/views/dashboard";
import proposalView from "../src/views/proposal";

type ContactsData = LoaderData<typeof contactsView>;
type ContactDetailData = LoaderData<typeof contactDetailView>;
type PipelineData = LoaderData<typeof pipelineView>;
type DashboardData = LoaderData<typeof dashboardView>;
type ProposalData = LoaderData<typeof proposalView>;

// --- 3. Validate contacts data has enriched fields from the loader ---

function checkContactsData(data: ContactsData) {
  const first = data[0];
  // Original schema fields (camelCase from Drizzle)
  const _id: string = first.id;
  const _name: string = first.name;
  const _company: string | null = first.company;
  const _email: string | null = first.email;
  const _lastContacted: string | null = first.lastContactedAt;

  // Enriched fields from the loader (not in raw schema)
  const _dealCount: number = first.dealCount;
  const _lastActivity: number | null = first.lastActivityAt;
}

// --- 4. Validate contact detail data has nested joins ---

function checkContactDetailData(data: ContactDetailData) {
  if (!data) return; // loader returns null for not found

  const _contactName: string = data.contact.name;
  const _contactCompany: string | null = data.contact.company;

  const firstDeal = data.deals[0];
  const _dealName: string = firstDeal.name;
  const _dealStage: string = firstDeal.stage;
  const _dealValue: number | null = firstDeal.value;

  const firstActivity = data.recentActivities[0];
  const _activityType: string = firstActivity.type;
  const _activityDesc: string = firstActivity.description;
}

// --- 5. Validate pipeline data has contact names from join ---

function checkPipelineData(data: PipelineData) {
  const first = data[0];
  const _dealName: string = first.name;
  const _stage: string = first.stage;
  const _value: number | null = first.value;
  // This field comes from the LEFT JOIN — proves the loader's join works
  const _contactName: string | null = first.contactName;
}

// --- 6. Validate dashboard data has computed summaries ---

function checkDashboardData(data: DashboardData) {
  const _total: number = data.total;
  const _open: number = data.open;
  const _won: number = data.won;

  const firstStage = data.stages[0];
  const _stageName: string = firstStage.stage;
  const _stageCount: number = firstStage.count;
  const _stageValue: number = firstStage.value;

  const firstActivity = data.recentActivities[0];
  const _actType: string = firstActivity.type;
}

// --- 7. Validate proposal data has deal name from join ---

function checkProposalData(data: ProposalData) {
  const first = data[0];
  const _content: string = first.content;
  const _version: number = first.version;
  const _status: string = first.status;
  // Joined field — not in raw proposals table
  const _dealName: string | null = first.dealName;
}

// --- 8. Validate schema produces camelCase types ---

import { contacts, deals } from "../src/schema";

type Contact = typeof contacts.$inferSelect;
type Deal = typeof deals.$inferSelect;

function checkCamelCase(c: Contact, d: Deal) {
  // These are camelCase (from Drizzle schema), not snake_case (from raw SQL)
  const _lastContacted: string | null = c.lastContactedAt;
  const _contactId: string | null = d.contactId;
  const _expectedClose: string | null = d.expectedCloseDate;
  const _createdAt: Date | null = d.createdAt;
}

// --- 9. Validate tool handler returns KitToolResult ---

import { addContact } from "../src/tools/add-contact";
type AddContactResult = ReturnType<typeof addContact.handler>;
const _toolResult: Promise<KitToolResult> = {} as AddContactResult;

// --- 10. Validate shared queries are callable from both tools and loaders ---

import { getContactDetail } from "../src/queries/contacts";
import { getDealsWithContacts, getPipelineSummary } from "../src/queries/deals";
import { getProposalsWithDeals } from "../src/queries/proposals";

// These functions are used by both tools (for markdown output) and loaders (for typed data).
// If they type-check here, the shared query pattern works.
type ContactDetailResult = Awaited<ReturnType<typeof getContactDetail>>;
type DealsResult = Awaited<ReturnType<typeof getDealsWithContacts>>;
type PipelineResult = Awaited<ReturnType<typeof getPipelineSummary>>;
type ProposalResult = Awaited<ReturnType<typeof getProposalsWithDeals>>;
