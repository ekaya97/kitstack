import { defineLoader } from "../../sdk";
import { getContactDetailTool } from "../../tools/get-contact-detail";

export const loader = defineLoader(async (db, ctx) => {
  const contactId = ctx.params?.contactId;
  if (!contactId) throw new Error("contactId param is required");
  return getContactDetailTool.load(db, { contactId }, ctx);
});
