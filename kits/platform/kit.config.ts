import { defineKit } from "@kitstackco/sdk";
import overview from "./src/views/overview/index.js";
import usageFinops from "./src/views/usage-finops/index.js";
import registry from "./src/views/registry/index.js";
import grants from "./src/views/grants/index.js";
import { getPlatformOverview, getUsageFinops, listPlatformGrants } from "./src/tools/platform-tools.js";

export default defineKit({
  id: "platform",
  version: "0.1.0",
  name: "KitStack Platform",
  description: "Grant-controlled platform registry, usage, observability, and FinOps views.",
  schema: {},
  instructions: "Use metadata-only platform data. Do not expose prompts, completions, transcripts, audio, or tool payloads.",
  triggers: ["platform", "registry", "usage", "observability", "finops", "grants"],
  tools: [getPlatformOverview, getUsageFinops, listPlatformGrants],
  views: [overview, usageFinops, registry, grants],
});
