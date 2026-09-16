import { defineLoader } from "@kitstackco/sdk";
import { listTriggersTool } from "../../tools/list-triggers.js";

export const loader = defineLoader(async (ctx) => listTriggersTool.load(ctx, {}));
