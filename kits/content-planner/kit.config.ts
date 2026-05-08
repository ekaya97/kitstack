import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Tools
import { captureIdea } from "./src/tools/capture-idea";
import { createContent } from "./src/tools/create-content";
import { updateContent } from "./src/tools/update-content";
import { logPerformance } from "./src/tools/log-performance";
import { listIdeas } from "./src/tools/list-ideas";
import { listContent } from "./src/tools/list-content";
import { calendar } from "./src/tools/calendar";
import { topicAnalysis } from "./src/tools/topic-analysis";
import { performanceReport } from "./src/tools/performance-report";
import { suggestTopics } from "./src/tools/suggest-topics";
import { archive } from "./src/tools/archive";
import { addTopic } from "./src/tools/add-topic";

// Views
import calendarView from "./src/views/calendar";
import ideasBoardView from "./src/views/ideas-board";
import performanceDashboardView from "./src/views/performance-dashboard";

export default defineKit({
  id: "content-planner",
  version: "1.0.0",
  name: "Content Planner",
  description:
    "Content planning for solopreneurs — capture ideas, draft posts, schedule publishing across LinkedIn, blog, newsletter, and more. Track performance and discover what topics resonate.",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: [
    "content",
    "post",
    "blog",
    "newsletter",
    "linkedin",
    "idea",
    "publish",
    "schedule",
    "social-media",
  ],
  tools: [
    captureIdea,
    createContent,
    updateContent,
    logPerformance,
    listIdeas,
    listContent,
    calendar,
    topicAnalysis,
    performanceReport,
    suggestTopics,
    archive,
    addTopic,
  ],
  views: [calendarView, ideasBoardView, performanceDashboardView],
});
