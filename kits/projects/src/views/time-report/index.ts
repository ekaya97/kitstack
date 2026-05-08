import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { TimeReportView } from "./View";

export default defineView({
  slug: "time-report",
  name: "Time Report",
  description: "for time logged across projects with daily breakdown and monthly summary",
  loader,
  component: TimeReportView,
  height: 520,
  placeholder: {
    monthlyByProject: [
      { projectName: "Brand Redesign", totalMinutes: 2940, billableMinutes: 2700, hourlyRate: 120 },
      { projectName: "API Integration", totalMinutes: 1560, billableMinutes: 1560, hourlyRate: 150 },
      { projectName: "Q3 Retainer", totalMinutes: 480, billableMinutes: 480, hourlyRate: 100 },
    ],
    dailyEntries: [
      { entryDate: "2026-05-02", projectName: "Brand Redesign", totalMinutes: 240 },
      { entryDate: "2026-05-02", projectName: "API Integration", totalMinutes: 120 },
      { entryDate: "2026-05-03", projectName: "Brand Redesign", totalMinutes: 180 },
      { entryDate: "2026-05-04", projectName: "API Integration", totalMinutes: 300 },
      { entryDate: "2026-05-05", projectName: "Brand Redesign", totalMinutes: 360 },
      { entryDate: "2026-05-05", projectName: "Q3 Retainer", totalMinutes: 120 },
      { entryDate: "2026-05-06", projectName: "Brand Redesign", totalMinutes: 240 },
      { entryDate: "2026-05-06", projectName: "API Integration", totalMinutes: 180 },
      { entryDate: "2026-05-07", projectName: "API Integration", totalMinutes: 240 },
      { entryDate: "2026-05-07", projectName: "Q3 Retainer", totalMinutes: 120 },
      { entryDate: "2026-05-08", projectName: "Brand Redesign", totalMinutes: 300 },
      { entryDate: "2026-05-08", projectName: "API Integration", totalMinutes: 180 },
    ],
    monthStart: "2026-05-01",
    today: "2026-05-08",
  },
});
