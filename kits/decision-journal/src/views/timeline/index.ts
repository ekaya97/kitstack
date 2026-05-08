import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { TimelineView } from "./View";

export default defineView({
  slug: "timeline",
  name: "Decision Timeline",
  description: "for a chronological view of all decisions with outcome indicators and expandable details",
  loader,
  component: TimelineView,
  height: 550,
  placeholder: [
    { id: "d1", title: "Chose React over Vue for the dashboard", category: "product", confidence: "high", stakes: "medium", decidedAt: "2026-05-01", context: "Needed a frontend framework for the new dashboard", decision: "Go with React", reasoning: "Team has more React experience, ecosystem is larger", reversibility: "hard_to_reverse", outcome: "good" },
    { id: "d2", title: "Hired a senior backend engineer instead of two juniors", category: "hiring", confidence: "medium", stakes: "high", decidedAt: "2026-04-28", context: "Team needs more backend capacity", decision: "One senior hire", reasoning: "Mentorship capacity is limited right now", reversibility: "hard_to_reverse", outcome: null },
    { id: "d3", title: "Raised prices by 20% for new customers", category: "financial", confidence: "low", stakes: "high", decidedAt: "2026-04-15", context: "Current pricing doesn't reflect value delivered", decision: "20% price increase for new contracts", reasoning: "Competitor analysis shows we're underpriced", reversibility: "easily_reversible", outcome: "mixed" },
    { id: "d4", title: "Postponed mobile app to Q3", category: "strategy", confidence: "medium", stakes: "medium", decidedAt: "2026-04-10", context: "Resource constraints and web platform priorities", decision: "Delay mobile until Q3", reasoning: "Web conversion funnel needs optimization first", reversibility: "easily_reversible", outcome: null },
    { id: "d5", title: "Switched from Slack to Discord for community", category: "business", confidence: "high", stakes: "low", decidedAt: "2026-04-02", context: "Community engagement was low on Slack", decision: "Migrate to Discord", reasoning: "Discord has better engagement features for communities", reversibility: "hard_to_reverse", outcome: "good" },
  ],
});
