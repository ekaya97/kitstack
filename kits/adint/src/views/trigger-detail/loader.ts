import { defineLoader } from "@kitstackco/sdk";
import { listTriggers } from "../../domain/read-model.js";

// DRAFT: loaders take no free-form params, so proper "show trigger X" needs a ui_state table
// written by get_trigger (see Fressnapf's ui_state pattern). For Stage A this returns the
// top-ranked trigger (or null). Wire ui_state when the trigger layer produces data.
export const loader = defineLoader(async (db, _ctx) => {
  const triggers = await listTriggers(db);
  return triggers[0] ?? null;
});
