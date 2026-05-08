import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { PerformanceDashboardView } from "./View";

export default defineView({
  slug: "performance-dashboard",
  name: "Performance Dashboard",
  description:
    "for viewing content analytics — impressions, engagements, top performers, and trends over time",
  loader,
  component: PerformanceDashboardView,
  height: 620,
  placeholder: {
    totals: { published: 24, impressions: 45200, engagements: 3840, clicks: 620 },
    topContent: [
      { id: "cnt_001", title: "AI Workflows for Solopreneurs", channel: "linkedin", publishedDate: "2026-05-06", impressions: 12400, engagements: 890, clicks: 145 },
      { id: "cnt_002", title: "Why I Stopped Using Notion", channel: "blog", publishedDate: "2026-04-28", impressions: 8200, engagements: 520, clicks: 210 },
      { id: "cnt_003", title: "Pricing for Consultants", channel: "linkedin", publishedDate: "2026-04-22", impressions: 6800, engagements: 445, clicks: 78 },
    ],
    byChannel: [
      { channel: "linkedin", count: 14, impressions: 28000, engagements: 2400 },
      { channel: "blog", count: 6, impressions: 12000, engagements: 980 },
      { channel: "newsletter", count: 4, impressions: 5200, engagements: 460 },
    ],
    trend: [
      { month: "Dec", published: 3, engagements: 420 },
      { month: "Jan", published: 4, engagements: 580 },
      { month: "Feb", published: 5, engagements: 710 },
      { month: "Mar", published: 4, engagements: 650 },
      { month: "Apr", published: 5, engagements: 890 },
      { month: "May", published: 3, engagements: 590 },
    ],
  },
});
