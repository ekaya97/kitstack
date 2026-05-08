import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Views
import timelineView from "./src/views/timeline";
import reviewQueueView from "./src/views/review-queue";
import patternsDashboardView from "./src/views/patterns-dashboard";

// Tools
import { logDecision } from "./src/tools/log-decision";
import { logOutcome } from "./src/tools/log-outcome";
import { addPrinciple } from "./src/tools/add-principle";
import { archive } from "./src/tools/archive";
import { listDecisions } from "./src/tools/list-decisions";
import { search } from "./src/tools/search";
import { reviewDue } from "./src/tools/review-due";
import { decisionDetail } from "./src/tools/decision-detail";
import { listPrinciples } from "./src/tools/list-principles";
import { patterns } from "./src/tools/patterns";
import { calibration } from "./src/tools/calibration";

export default defineKit({
  id: "decision-journal",
  version: "1.0.0",
  name: "Decision Journal",
  description: "Track important decisions with reasoning, review outcomes, surface patterns, and build personal decision-making principles over time",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: [
    "decision", "outcome", "principle", "reasoning",
    "journal", "review", "pattern", "confidence",
    "calibration", "regret", "hindsight",
  ],
  views: [timelineView, reviewQueueView, patternsDashboardView],
  tools: [
    logDecision,
    logOutcome,
    addPrinciple,
    archive,
    listDecisions,
    search,
    reviewDue,
    decisionDetail,
    listPrinciples,
    patterns,
    calibration,
  ],
});
