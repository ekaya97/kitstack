import { defineKit } from "./src/sdk";
import * as schema from "./src/schema";
import { migrationSql } from "./src/migrations";
import { crmInstructions } from "./src/instructions";

// Tools
import { addContact } from "./src/tools/add-contact";
import { listContacts } from "./src/tools/list-contacts";
import { searchContacts } from "./src/tools/search-contacts";
import { addDeal } from "./src/tools/add-deal";
import { listDeals } from "./src/tools/list-deals";
import { updateDeal } from "./src/tools/update-deal";
import { addActivity } from "./src/tools/add-activity";
import { getContactDetailTool } from "./src/tools/get-contact-detail";
import { pipelineDashboard } from "./src/tools/pipeline-dashboard";
import { generateProposal } from "./src/tools/generate-proposal";
import { exportData } from "./src/tools/export";

// Views
import contactsView from "./src/views/contacts";
import contactDetailView from "./src/views/contact-detail";
import pipelineView from "./src/views/pipeline";
import dashboardView from "./src/views/dashboard";
import proposalView from "./src/views/proposal";

export default defineKit({
  id: "crm",
  name: "CRM Kit",
  description: "Full CRM with contacts, deals, pipeline, and proposals",
  schema,
  migrationSql,
  instructions: crmInstructions,
  tools: [
    addContact,
    listContacts,
    searchContacts,
    addDeal,
    listDeals,
    updateDeal,
    addActivity,
    getContactDetailTool,
    pipelineDashboard,
    generateProposal,
    exportData,
  ],
  views: [
    contactsView,
    contactDetailView,
    pipelineView,
    dashboardView,
    proposalView,
  ],
});
