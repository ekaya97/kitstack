import { defineLoader } from "../../sdk";
import { desc } from "drizzle-orm";
import { prospects } from "../../schema";

export const loader = defineLoader(async (db, ctx) => {
  return db.select().from(prospects).orderBy(desc(prospects.createdAt));
});
