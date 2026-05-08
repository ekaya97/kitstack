import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ReviewQueueView } from "./View";

export default defineView({
  slug: "review-queue",
  name: "Review Queue",
  description: "to see decisions due for review — overdue and upcoming — so you can log outcomes",
  loader,
  component: ReviewQueueView,
  height: 450,
  placeholder: [
    { id: "d1", title: "Raised prices by 20% for new customers", category: "financial", confidence: "low", decidedAt: "2026-03-15", reviewDate: "2026-05-01", context: "Pricing review", decision: "Increase prices 20% for new contracts" },
    { id: "d2", title: "Hired senior backend engineer", category: "hiring", confidence: "medium", decidedAt: "2026-03-28", reviewDate: "2026-05-07", context: "Team scaling", decision: "One senior hire instead of two juniors" },
    { id: "d3", title: "Switched to Discord for community", category: "business", confidence: "high", decidedAt: "2026-04-02", reviewDate: "2026-05-15", context: "Low engagement", decision: "Migrate community from Slack to Discord" },
    { id: "d4", title: "Postponed mobile app to Q3", category: "strategy", confidence: "medium", decidedAt: "2026-04-10", reviewDate: "2026-06-10", context: "Resource constraints", decision: "Delay mobile development" },
  ],
});
