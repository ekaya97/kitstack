import { defineKit } from "@kitstackco/sdk";
import {
  createDebriefTools,
  type DebriefToolHandler,
  type DebriefToolName,
} from "./src/tools";

export type { DebriefToolHandler, DebriefToolName } from "./src/tools";

export function createDebriefKit(
  handlers: Partial<Record<DebriefToolName, DebriefToolHandler>> = {},
) {
  const tools = createDebriefTools(handlers);

  return defineKit({
    id: "debrief",
    version: "0.1.0",
    name: "Sales Debrief",
    description: "Prepare, conduct, confirm, and teach a short sales voice debrief.",
    schema: {},
    migrationSql: "SELECT 1;",
    instructions: "Use the injected demo debrief service; never retain call transcripts or audio.",
    triggers: ["sales", "debrief", "voice", "customer", "follow-up"],
    tools,
  });
}

const defaultKit = createDebriefKit();
export const tools = defaultKit.tools;
export default defaultKit;
