import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Views
import dashboardView from "./src/views/dashboard";
import projectDetailView from "./src/views/project-detail";
import timeReportView from "./src/views/time-report";

// Tools
import { addClient } from "./src/tools/add-client";
import { addProject } from "./src/tools/add-project";
import { addMilestone } from "./src/tools/add-milestone";
import { addTask } from "./src/tools/add-task";
import { updateTask } from "./src/tools/update-task";
import { updateProject } from "./src/tools/update-project";
import { updateMilestone } from "./src/tools/update-milestone";
import { logTime } from "./src/tools/log-time";
import { archive } from "./src/tools/archive";
import { listProjects } from "./src/tools/list-projects";
import { listTasks } from "./src/tools/list-tasks";
import { projectOverview } from "./src/tools/project-overview";
import { dashboard } from "./src/tools/dashboard";
import { timeReport } from "./src/tools/time-report";
import { budgetStatus } from "./src/tools/budget-status";

export default defineKit({
  id: "projects",
  version: "1.0.0",
  name: "Projects",
  description: "Project management for freelancers: track clients, projects, tasks, milestones, time, and budgets through conversation",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: [
    "project", "task", "milestone", "time", "client",
    "deadline", "budget", "hours", "timesheet",
  ],
  views: [dashboardView, projectDetailView, timeReportView],
  tools: [
    addClient,
    addProject,
    addMilestone,
    addTask,
    updateTask,
    updateProject,
    updateMilestone,
    logTime,
    archive,
    listProjects,
    listTasks,
    projectOverview,
    dashboard,
    timeReport,
    budgetStatus,
  ],
});
