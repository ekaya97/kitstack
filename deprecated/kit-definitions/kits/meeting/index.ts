import { defineKit } from "../../framework";
import * as schema from "./schema";
import { migrationSql } from "./migrations";
import { meetingInstructions } from "./instructions";
import { processMeeting } from "./tools/process-meeting";
import { listMeetings } from "./tools/list-meetings";
import { getMeeting } from "./tools/get-meeting";
import { listActions } from "./tools/list-actions";
import { updateAction } from "./tools/update-action";
import { openItemsSummary } from "./tools/open-items-summary";

export default defineKit({
  id: "meeting-action-tracker",
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
