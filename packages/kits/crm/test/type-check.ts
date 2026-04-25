/**
 * Type validation file — NOT a runtime test.
 * If `tsc --noEmit` passes on this file, the SDK type flow works end-to-end.
 */

import type { Infer, KitDefinition } from "@kitstack/sdk";

// --- 1. Validate kit.config.ts produces KitDefinition ---

import kit from "../kit.config";
const _kitDef: KitDefinition = kit;

// --- 2. Validate tool.load() type inference ---

import { listDeals } from "../src/tools/list-deals";
import { listContacts } from "../src/tools/list-contacts";
import { getContactDetailTool } from "../src/tools/get-contact-detail";
import { pipelineDashboard } from "../src/tools/pipeline-dashboard";
import { listProposals } from "../src/tools/list-proposals";

// listDeals.load returns deals with contactName from the join
type DealsData = Infer<typeof listDeals.load>;
function checkDeals(data: DealsData) {
  const first = data[0];
  const _name: string = first.name;
  const _stage: string = first.stage;
  const _contactName: string | null = first.contactName;
  const _value: number | null = first.value;
}

// listContacts.load returns raw contacts
type ContactsData = Infer<typeof listContacts.load>;
function checkContacts(data: ContactsData) {
  const first = data[0];
  const _name: string = first.name;
  const _email: string | null = first.email;
  const _lastContacted: string | null = first.lastContactedAt;
}

// getContactDetailTool.load returns contact + deals + activities
type DetailData = Infer<typeof getContactDetailTool.load>;
function checkDetail(data: DetailData) {
  if (!data) return;
  const _contactName: string = data.contact.name;
  const _dealName: string = data.deals[0].name;
  const _activityType: string = data.recentActivities[0].type;
}

// pipelineDashboard.load returns summary
type DashboardData = Infer<typeof pipelineDashboard.load>;
function checkDashboard(data: DashboardData) {
  const _total: number = data.total;
  const _open: number = data.open;
  const _won: number = data.won;
  const _stageCount: number = data.stages[0].count;
}

// --- 3. Validate loader → view type flow ---

import { loader as pipelineLoader } from "../src/views/pipeline/loader";
import { loader as contactsLoader } from "../src/views/contacts/loader";

// Loader calls tool.load() — types should match
type PipelineViewData = Infer<typeof pipelineLoader>;
function checkPipelineView(data: PipelineViewData) {
  const first = data[0];
  const _contactName: string | null = first.contactName;
}

// --- 4. Validate schema produces camelCase ---

import { contacts, deals } from "../src/schema";
type Contact = typeof contacts.$inferSelect;
type Deal = typeof deals.$inferSelect;

function checkCamelCase(c: Contact, d: Deal) {
  const _lastContacted: string | null = c.lastContactedAt;
  const _contactId: string | null = d.contactId;
  const _expectedClose: string | null = d.expectedCloseDate;
}
