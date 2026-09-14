import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { uiState } from "../schema";

/** Record the result set of the latest search so `product_list` can render it. */
export async function setLastSearch(
  db: LibSQLDatabase,
  userId: string,
  ids: string[],
  label: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(uiState)
    .values({ userId, lastSearchIds: JSON.stringify(ids), lastSearchLabel: label, updatedAt: now })
    .onConflictDoUpdate({
      target: uiState.userId,
      set: { lastSearchIds: JSON.stringify(ids), lastSearchLabel: label, updatedAt: now },
    });
}

/** Record which product the user is looking at so `product_detail` can render it. */
export async function setCurrentProduct(
  db: LibSQLDatabase,
  userId: string,
  productId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(uiState)
    .values({ userId, currentProductId: productId, updatedAt: now })
    .onConflictDoUpdate({
      target: uiState.userId,
      set: { currentProductId: productId, updatedAt: now },
    });
}

export async function getUiState(db: LibSQLDatabase, userId: string) {
  const rows = await db.select().from(uiState).where(eq(uiState.userId, userId)).limit(1);
  return rows[0] ?? null;
}
