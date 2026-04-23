import { defineKit } from "../../framework";
import * as schema from "./schema";
import { migrationSql } from "./migrations";
import { crmInstructions } from "./instructions";
import { addContact } from "./tools/add-contact";
import { listContacts } from "./tools/list-contacts";
import { searchContacts } from "./tools/search-contacts";
import { addDeal } from "./tools/add-deal";
import { listDeals } from "./tools/list-deals";
import { updateDeal } from "./tools/update-deal";
import { addActivity } from "./tools/add-activity";
import { getContactDetail } from "./tools/get-contact-detail";
import { pipelineDashboard } from "./tools/pipeline-dashboard";
import { generateProposal } from "./tools/generate-proposal";
import { exportData } from "./tools/export";

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
    getContactDetail,
    pipelineDashboard,
    generateProposal,
    exportData,
  ],
});
