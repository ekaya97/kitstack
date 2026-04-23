import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authors, type Author } from "@/db/schema";

export async function getAuthorByHandle(handle: string): Promise<Author | null> {
  const results = await db
    .select()
    .from(authors)
    .where(eq(authors.handle, handle))
    .limit(1);
  return results[0] ?? null;
}

export async function getAllAuthors(): Promise<Author[]> {
  return db.select().from(authors).orderBy(authors.displayName);
}
