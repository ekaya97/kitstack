import { defineLoader } from "../../sdk";
import { getContactDetailTool } from "../../tools/get-contact-detail";

export const loader = defineLoader(async (db, ctx) => {
  const contactId = ctx.params?.contactId;
  if (!contactId) return null;
  return getContactDetailTool.load(db, { contactId }, ctx);
});
