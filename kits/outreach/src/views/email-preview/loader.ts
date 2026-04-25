import { defineLoader } from "../../sdk";
import { asc } from "drizzle-orm";
import { emails } from "../../schema";

export const loader = defineLoader(async (db, ctx) => {
  return db.select().from(emails).orderBy(asc(emails.position));
});
