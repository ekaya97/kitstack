import { defineLoader } from "@kitstackco/sdk";
import { adGraph } from "../../tools/ad-graph.js";

// Overview by default (no publisher → collapsed, buyers as the subject).
export const loader = defineLoader(async (ctx) => adGraph.load(ctx, {}));
