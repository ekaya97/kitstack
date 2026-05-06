import { defineKit } from "@kitstackco/sdk";
import { resolve } from "node:path";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Views
import pipelineView from "./src/views/pipeline";
import contactsView from "./src/views/contacts";
import followUpsView from "./src/views/follow-ups";

// Tools
import { addCompany } from "./src/tools/add-company";
import { addContact } from "./src/tools/add-contact";
import { logInteraction } from "./src/tools/log-interaction";
import { addDeal } from "./src/tools/add-deal";
import { updateDeal } from "./src/tools/update-deal";
import { updateContact } from "./src/tools/update-contact";
import { search } from "./src/tools/search";
import { listContacts } from "./src/tools/list-contacts";
import { listDeals } from "./src/tools/list-deals";
import { followUps } from "./src/tools/follow-ups";
import { pipeline } from "./src/tools/pipeline";
import { archive } from "./src/tools/archive";

export default defineKit({
  id: "crm",
  version: "1.0.0",
  name: "CRM",
  description: "Personal CRM for tracking contacts, companies, deals, and interactions",
  schema,
  migrationsDir: resolve(import.meta.dirname, "migrations"),
  instructions,
  triggers: [
    "contact", "company", "deal", "pipeline", "follow-up",
    "crm", "relationship", "sales", "proposal",
  ],
  views: [pipelineView, contactsView, followUpsView],
  tools: [
    addCompany,
    addContact,
    logInteraction,
    addDeal,
    updateDeal,
    updateContact,
    search,
    listContacts,
    listDeals,
    followUps,
    pipeline,
    archive,
  ],
});
