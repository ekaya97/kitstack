import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ProjectDetailView } from "./View";

export default defineView({
  slug: "project-detail",
  name: "Project Detail",
  description: "for a detailed view of a single project with milestones, tasks, time, and budget",
  loader,
  component: ProjectDetailView,
  height: 600,
  placeholder: {
    project: {
      id: "prj_001", clientId: "cli_001", name: "Brand Redesign", description: "Complete brand refresh including logo, CI, and website",
      status: "active", priority: "high", startDate: "2026-04-01", dueDate: "2026-06-15", completedDate: null,
      budget: 25000, currency: "EUR", hourlyRate: 120, billingType: "hourly",
      notes: null, tags: "design,branding", archivedAt: null, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-05-08T00:00:00.000Z",
    },
    client: { id: "cli_001", name: "Müller & Partner GmbH", contactName: "Thomas Müller", contactEmail: "t.mueller@muellerpartner.de", industry: "Manufacturing", notes: null, archivedAt: null, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    milestones: [
      { id: "mil_001", projectId: "prj_001", name: "Logo Concepts", description: null, dueDate: "2026-05-01", completedDate: "2026-04-28", status: "completed", sortOrder: 0, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-28T00:00:00.000Z" },
      { id: "mil_002", projectId: "prj_001", name: "Visual Identity System", description: null, dueDate: "2026-05-20", completedDate: null, status: "in_progress", sortOrder: 1, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-05-08T00:00:00.000Z" },
      { id: "mil_003", projectId: "prj_001", name: "Website Launch", description: null, dueDate: "2026-06-15", completedDate: null, status: "pending", sortOrder: 2, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    ],
    tasks: [
      { id: "tsk_001", projectId: "prj_001", milestoneId: "mil_001", title: "Research competitor logos", description: null, status: "done", priority: "high", dueDate: "2026-04-15", completedDate: "2026-04-14", estimatedHours: 4, sortOrder: 0, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-14T00:00:00.000Z" },
      { id: "tsk_002", projectId: "prj_001", milestoneId: "mil_001", title: "Draft 3 logo variations", description: null, status: "done", priority: "high", dueDate: "2026-04-25", completedDate: "2026-04-24", estimatedHours: 8, sortOrder: 1, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-24T00:00:00.000Z" },
      { id: "tsk_003", projectId: "prj_001", milestoneId: "mil_002", title: "Define color palette", description: null, status: "done", priority: "medium", dueDate: "2026-05-05", completedDate: "2026-05-04", estimatedHours: 3, sortOrder: 2, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-05-04T00:00:00.000Z" },
      { id: "tsk_004", projectId: "prj_001", milestoneId: "mil_002", title: "Typography system", description: null, status: "in_progress", priority: "medium", dueDate: "2026-05-12", completedDate: null, estimatedHours: 5, sortOrder: 3, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-05-08T00:00:00.000Z" },
      { id: "tsk_005", projectId: "prj_001", milestoneId: "mil_002", title: "Business card & stationery", description: null, status: "todo", priority: "medium", dueDate: "2026-05-18", completedDate: null, estimatedHours: 4, sortOrder: 4, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
      { id: "tsk_006", projectId: "prj_001", milestoneId: "mil_003", title: "Homepage wireframe", description: null, status: "todo", priority: "high", dueDate: "2026-05-25", completedDate: null, estimatedHours: 6, sortOrder: 5, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
      { id: "tsk_007", projectId: "prj_001", milestoneId: "mil_003", title: "Responsive development", description: null, status: "todo", priority: "medium", dueDate: "2026-06-08", completedDate: null, estimatedHours: 16, sortOrder: 6, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
      { id: "tsk_008", projectId: "prj_001", milestoneId: null, title: "Client presentation deck", description: null, status: "todo", priority: "low", dueDate: "2026-06-12", completedDate: null, estimatedHours: 3, sortOrder: 7, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
    ],
    totalMinutes: 2940,
    billableMinutes: 2700,
  },
});
