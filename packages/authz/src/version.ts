import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { authzVersion } from "./schema";
import type { AuthzVersion } from "./types";

type DrizzleDb = LibSQLDatabase<any>;

const VERSION_ROW_ID = 1 as const;

/** Read the current grant version. An empty database starts at zero. */
export async function getAuthorizationVersion(db: DrizzleDb): Promise<AuthzVersion> {
  const rows = await db
    .select({ version: authzVersion.version })
    .from(authzVersion)
    .where(eq(authzVersion.id, VERSION_ROW_ID))
    .limit(1);

  return { id: VERSION_ROW_ID, version: rows[0]?.version ?? 0 };
}

/** Advance the version after a successful grant, revoke, or membership mutation. */
export async function bumpAuthorizationVersion(db: DrizzleDb): Promise<AuthzVersion> {
  await db
    .insert(authzVersion)
    .values({ id: VERSION_ROW_ID, version: 1 })
    .onConflictDoUpdate({
      target: authzVersion.id,
      set: { version: sql`${authzVersion.version} + 1` },
    });

  return getAuthorizationVersion(db);
}
