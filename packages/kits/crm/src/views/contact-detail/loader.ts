import { defineLoader } from "../../sdk";
import { getContactDetail } from "../../queries/contacts";

export const loader = defineLoader(async (db, ctx) => {
  const contactId = ctx.params?.contactId;
  if (!contactId) throw new Error("contactId param is required");
  return getContactDetail(db, contactId);
});
