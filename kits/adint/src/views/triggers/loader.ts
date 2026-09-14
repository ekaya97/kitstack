import { defineLoader } from "@kitstackco/sdk";
import { listTriggersTool } from "../../tools/list-triggers.js";

export const loader = defineLoader(async (db, ctx) => listTriggersTool.load(db, {}, ctx));
