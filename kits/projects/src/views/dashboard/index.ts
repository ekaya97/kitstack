import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { DashboardView } from "./View";

export default defineView({
  slug: "dashboard",
  name: "Dashboard",
  description: "for an overview of active projects, urgent tasks, and time logged this week",
  loader,
  component: DashboardView,
  height: 520,
  placeholder: {
    activeProjects: [
      { id: "prj_001", name: "Brand Redesign", status: "active", priority: "high", dueDate: "2026-06-15", budget: 25000, hourlyRate: 120, billingType: "hourly", clientName: "Müller & Partner GmbH" },
      { id: "prj_002", name: "API Integration", status: "active", priority: "medium", dueDate: "2026-08-30", budget: 42000, hourlyRate: 150, billingType: "hourly", clientName: "TechFlow B.V." },
      { id: "prj_003", name: "Q3 Retainer", status: "active", priority: "low", dueDate: null, budget: 9000, hourlyRate: 100, billingType: "retainer", clientName: "O'Brien Consulting" },
    ],
    taskCounts: [
      { projectId: "prj_001", total: 8, done: 5 },
      { projectId: "prj_002", total: 4, done: 1 },
      { projectId: "prj_003", total: 3, done: 0 },
    ],
    weeklyTime: [
      { projectId: "prj_001", projectName: "Brand Redesign", totalMinutes: 780 },
      { projectId: "prj_002", projectName: "API Integration", totalMinutes: 480 },
      { projectId: "prj_003", projectName: "Q3 Retainer", totalMinutes: 120 },
    ],
    urgentTasks: [
      { title: "Finalize logo concepts", status: "in_progress", priority: "urgent", dueDate: "2026-05-07", projectName: "Brand Redesign" },
      { title: "Set up staging environment", status: "todo", priority: "high", dueDate: "2026-05-10", projectName: "API Integration" },
      { title: "Review SEO audit results", status: "todo", priority: "high", dueDate: "2026-05-12", projectName: "Brand Redesign" },
    ],
    today: "2026-05-08",
  },
});
