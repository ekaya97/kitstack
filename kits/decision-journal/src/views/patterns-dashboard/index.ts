import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { PatternsDashboardView } from "./View";

export default defineView({
  slug: "patterns-dashboard",
  name: "Patterns Dashboard",
  description: "for visualizing decision-making patterns: category breakdown, confidence calibration, and principles",
  loader,
  component: PatternsDashboardView,
  height: 600,
  placeholder: {
    decisions: [
      { id: "d1", title: "Chose React over Vue", category: "product", confidence: "high", urgency: "medium", stakes: "medium", decidedAt: "2026-05-01" },
      { id: "d2", title: "Hired senior engineer", category: "hiring", confidence: "medium", urgency: "high", stakes: "high", decidedAt: "2026-04-28" },
      { id: "d3", title: "Raised prices 20%", category: "financial", confidence: "low", urgency: "low", stakes: "high", decidedAt: "2026-04-15" },
      { id: "d4", title: "Postponed mobile app", category: "strategy", confidence: "medium", urgency: "medium", stakes: "medium", decidedAt: "2026-04-10" },
      { id: "d5", title: "Switched to Discord", category: "business", confidence: "high", urgency: "low", stakes: "low", decidedAt: "2026-04-02" },
      { id: "d6", title: "Redesigned onboarding flow", category: "product", confidence: "high", urgency: "high", stakes: "high", decidedAt: "2026-03-20" },
      { id: "d7", title: "Partnered with Agency X", category: "business", confidence: "medium", urgency: "medium", stakes: "medium", decidedAt: "2026-03-10" },
    ],
    outcomes: [
      { id: "o1", decisionId: "d1", assessment: "good", wouldDecideDifferently: 0 },
      { id: "o2", decisionId: "d3", assessment: "mixed", wouldDecideDifferently: 1 },
      { id: "o3", decisionId: "d5", assessment: "good", wouldDecideDifferently: 0 },
      { id: "o4", decisionId: "d6", assessment: "good", wouldDecideDifferently: 0 },
      { id: "o5", decisionId: "d7", assessment: "bad", wouldDecideDifferently: 1 },
    ],
    principles: [
      { id: "p1", title: "Price for value delivered, not time spent", description: "Learned from underpricing the NovaTech project", timesReferenced: 3 },
      { id: "p2", title: "Don't rush hiring decisions under pressure", description: "Agency partnership taught this", timesReferenced: 1 },
      { id: "p3", title: "Validate with data before committing to irreversible changes", description: null, timesReferenced: 2 },
    ],
  },
});
