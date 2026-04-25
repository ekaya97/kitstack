import { defineKit } from "../../framework";
import * as schema from "./schema";
import { migrationSql } from "./migrations";
import { outreachInstructions } from "./instructions";
import { createSequence } from "./tools/create-sequence";
import { generateEmails } from "./tools/generate-emails";
import { listSequences } from "./tools/list-sequences";
import { addProspect } from "./tools/add-prospect";
import { personalizeForProspect } from "./tools/personalize-for-prospect";
import { editEmail } from "./tools/edit-email";
import { exportSequence } from "./tools/export-sequence";
import { updateSequence } from "./tools/update-sequence";
import { deleteSequence } from "./tools/delete-sequence";
import { deleteEmail } from "./tools/delete-email";
import { removeProspect } from "./tools/remove-prospect";

export default defineKit({
  id: "cold-outreach",
  name: "Cold Outreach Kit",
  description: "Email sequences, prospect management, and personalization for cold outreach",
  schema,
  migrationSql,
  instructions: outreachInstructions,
  tools: [
    createSequence,
    generateEmails,
    listSequences,
    addProspect,
    personalizeForProspect,
    editEmail,
    exportSequence,
    updateSequence,
    deleteSequence,
    deleteEmail,
    removeProspect,
  ],
});
