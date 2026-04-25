import { defineKit } from "./src/sdk";
import * as schema from "./src/schema";
import { migrationSql } from "./src/migrations";
import { meetingInstructions } from "./src/instructions";

// Tools
import { processMeeting } from "./src/tools/process-meeting";
import { listMeetings } from "./src/tools/list-meetings";
import { getMeeting } from "./src/tools/get-meeting";
import { listActions } from "./src/tools/list-actions";
import { updateAction } from "./src/tools/update-action";
import { openItemsSummary } from "./src/tools/open-items-summary";

export default defineKit({
  id: "meeting-action-tracker",
  version: "1.0.0",
  name: "Meeting Action Tracker Kit",
  description: "Track action items across meetings with persistent history",
  schema,
  migrationSql,
  instructions: meetingInstructions,
  tools: [
    processMeeting,
    listMeetings,
    getMeeting,
    listActions,
    updateAction,
    openItemsSummary,
  ],
});
