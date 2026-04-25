import { defineKit } from "./src/sdk";
import * as schema from "./src/schema";
import { migrationSql } from "./src/migrations";
import { outreachInstructions } from "./src/instructions";

// Tools
import { listSequences } from "./src/tools/list-sequences";
import { createSequence } from "./src/tools/create-sequence";
import { deleteSequence } from "./src/tools/delete-sequence";
import { updateSequence } from "./src/tools/update-sequence";
import { addProspect } from "./src/tools/add-prospect";
import { removeProspect } from "./src/tools/remove-prospect";
import { setProspectHooks } from "./src/tools/set-prospect-hooks";
import { editEmail } from "./src/tools/edit-email";
import { deleteEmail } from "./src/tools/delete-email";
import { addEmails } from "./src/tools/add-emails";
import { exportSequence } from "./src/tools/export-sequence";

export default defineKit({
  id: "cold-outreach",
  version: "1.0.0",
  name: "Cold Outreach Kit",
  description: "Build, manage, and personalize email sequences for outbound sales",
  schema,
  migrationSql,
  instructions: outreachInstructions,
  tools: [
    listSequences,
    createSequence,
    deleteSequence,
    updateSequence,
    addProspect,
    removeProspect,
    setProspectHooks,
    editEmail,
    deleteEmail,
    addEmails,
    exportSequence,
  ],
});
