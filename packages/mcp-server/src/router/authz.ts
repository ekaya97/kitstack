import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Resource } from "sst";
import { authorize } from "../../../authz/src/middleware";
import { check } from "../../../authz/src/engine";
import type { AuthzRequirement, Relation, ObjectType } from "../../../authz/src/types";
import { verifyAccessToken } from "../router/oauth/helpers";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily create a Drizzle client for the main Turso DB (shared by authz + registry). */
export function getTursoDb() {
  if (!_db) {
    const client = createClient({
      url: Resource.TursoDbUrl.value,
      authToken: Resource.TursoAuthToken.value,
    });
    _db = drizzle(client);
  }
  return _db;
}

/**
 * MCP-side authorization: verify JWT + check tuple requirements.
 * Throws on failure.
 */
export async function mcpRequireAuthorized(
  token: string,
  requirements: AuthzRequirement[] = []
): Promise<{ userId: string }> {
  const { userId } = await verifyAccessToken(token);

  if (requirements.length > 0) {
    const db = getTursoDb();
    const result = await authorize(db, { userId }, requirements);
    if (!result.allowed) {
      throw new Error(result.reason ?? "Forbidden");
    }
  }

  return { userId };
}

/**
 * Check a single tuple from the MCP side.
 * Useful for tool-level authorization (e.g. "does user have activator on kit:X?").
 */
export async function mcpCheckTuple(
  userId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string
): Promise<boolean> {
  const db = getTursoDb();
  const result = await check(db, {
    subjectId: userId,
    relation,
    objectType,
    objectId,
  });
  return result.allowed;
}
