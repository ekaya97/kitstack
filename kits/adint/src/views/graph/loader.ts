import { defineLoader } from "@kitstackco/sdk";
import { adGraph } from "../../tools/ad-graph.js";

// Overview by default (no publisher → collapsed, buyers as the subject).
export const loader = defineLoader(async (db, ctx) => adGraph.load(db, {}, ctx));
