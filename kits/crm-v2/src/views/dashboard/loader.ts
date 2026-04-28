import { defineLoader } from "@kitstack/sdk";
import { listItems } from "../../tools/example";

export const loader = defineLoader(async (db, ctx) => {
  return listItems.load(db, { limit: 100 }, ctx);
});
