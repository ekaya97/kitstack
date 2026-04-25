import { defineLoader } from "../../sdk";
import { getContactsWithStats } from "../../queries/contacts";

export const loader = defineLoader(async (db, ctx) => {
  return getContactsWithStats(db);
});
