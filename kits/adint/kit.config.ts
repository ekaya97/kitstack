import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Tools (read surface — Stage A)
import { adGraph } from "./src/tools/ad-graph";
import { listPublishers } from "./src/tools/list-publishers";
import { brandTimelineTool } from "./src/tools/brand-timeline";
import { listTriggersTool } from "./src/tools/list-triggers";
import { getTrigger } from "./src/tools/get-trigger";

// Views (chat host — draft)
import graph from "./src/views/graph";
import triggers from "./src/views/triggers";
import triggerDetail from "./src/views/trigger-detail";

export default defineKit({
  id: "adint",
  version: "0.1.0",
  name: "Ad Intelligence",
  description:
    "Ad-intelligence for Ströer: which brands advertise on competitors but not on us, and which agency to call. Cross-publisher ad graph + 'call this agency' opportunities. Stage A read surface over a seeded snapshot from the standalone adint product — see .track/specs/adint-kit-spec.md.",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: [
    "adint",
    "advertising",
    "advertisers",
    "competitors",
    "opportunities",
    "ad graph",
    "werbung",
    "wettbewerber",
    "kampagne",
    "ströer",
    "stroeer",
  ],
  tools: [adGraph, listPublishers, brandTimelineTool, listTriggersTool, getTrigger],
  views: [graph, triggers, triggerDetail],
});
