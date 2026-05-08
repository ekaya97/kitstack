import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { CalendarView } from "./View";

export default defineView({
  slug: "calendar",
  name: "Content Calendar",
  description: "for viewing scheduled and published content on a monthly calendar grid",
  loader,
  component: CalendarView,
  height: 540,
  placeholder: {
    items: [
      { id: "cnt_001", title: "AI Workflows for Solopreneurs", channel: "linkedin", format: "post", status: "published", scheduledDate: "2026-05-06", publishedDate: "2026-05-06" },
      { id: "cnt_002", title: "Weekly Newsletter #12", channel: "newsletter", format: "newsletter", status: "scheduled", scheduledDate: "2026-05-09", publishedDate: null },
      { id: "cnt_003", title: "How I Automated Client Onboarding", channel: "blog", format: "article", status: "scheduled", scheduledDate: "2026-05-13", publishedDate: null },
      { id: "cnt_004", title: "Pricing Mistakes I Made", channel: "linkedin", format: "post", status: "draft", scheduledDate: "2026-05-15", publishedDate: null },
    ],
    month: 4,
    year: 2026,
    monthStart: "2026-05-01",
    monthEnd: "2026-05-31",
    lastDay: 31,
  },
});
