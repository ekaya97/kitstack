import { defineLoader } from "../../sdk";
import { listContacts } from "../../tools/list-contacts";

export const loader = defineLoader(async (db, ctx) => {
  return listContacts.load(db, { limit: 100 }, ctx);
});
