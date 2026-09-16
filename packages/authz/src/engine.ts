import { eq, and, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { authzMemberships, authzTuples } from "./schema";
import { getAuthorizationVersion } from "./version";
import type { AuthzCacheOptions, CheckInput, CheckResult, Relation, ObjectType, SubjectType } from "./types";
import { AUTHZ_CACHE_TTL_MS } from "./types";

type DrizzleDb = LibSQLDatabase<any>;
type CacheableDb = object;

interface CachedDecision {
  allowed: boolean;
  expiresAt: number;
}

interface CacheState {
  version: number;
  decisions: Map<string, CachedDecision>;
}

function cacheKey(input: CheckInput): string {
  return [
    input.subjectType ?? "user",
    input.subjectId,
    input.relation,
    input.objectType,
    input.objectId,
  ].join("\u001f");
}

/**
 * Per-process decision cache invalidated by the database's monotonic version.
 * The version is checked on every request, so a revoke does not wait for the
 * ten-minute cache TTL. The TTL only controls reuse when no grant changed.
 */
export class VersionedGrantCache {
  private readonly states = new WeakMap<CacheableDb, CacheState>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: AuthzCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? AUTHZ_CACHE_TTL_MS;
    this.now = options.now ?? Date.now;

    if (this.ttlMs < 5 * 60 * 1000 || this.ttlMs > 15 * 60 * 1000) {
      throw new Error("Authz cache TTL must be between five and fifteen minutes");
    }
  }

  async check(db: DrizzleDb, input: CheckInput): Promise<CheckResult> {
    const currentVersion = await getAuthorizationVersion(db);
    let state = this.states.get(db as CacheableDb);

    if (!state || state.version !== currentVersion.version) {
      state = { version: currentVersion.version, decisions: new Map() };
      this.states.set(db as CacheableDb, state);
    }

    const key = cacheKey(input);
    const now = this.now();
    const cached = state.decisions.get(key);
    if (cached && cached.expiresAt > now) {
      return { allowed: cached.allowed };
    }

    const allowed = await queryDecision(db, input);
    state.decisions.set(key, { allowed, expiresAt: now + this.ttlMs });
    return { allowed };
  }

  clear(db?: DrizzleDb): void {
    if (db) {
      this.states.delete(db as CacheableDb);
    }
  }
}

const defaultCache = new VersionedGrantCache();

/** Check direct grants and one-hop user membership through teams or roles. */
export async function check(db: DrizzleDb, input: CheckInput): Promise<CheckResult> {
  return defaultCache.check(db, input);
}

async function queryDecision(db: DrizzleDb, input: CheckInput): Promise<boolean> {
  const subjectType = input.subjectType ?? "user";
  const directSubject = and(
    eq(authzTuples.subjectType, subjectType),
    eq(authzTuples.subjectId, input.subjectId)
  );
  const subjectCondition = subjectType === "user"
    ? or(
        directSubject,
        and(
          eq(authzMemberships.memberType, "user"),
          eq(authzMemberships.memberId, input.subjectId)
        )
      )
    : directSubject;

  const rows = await db
    .select({ id: authzTuples.id })
    .from(authzTuples)
    .leftJoin(
      authzMemberships,
      and(
        eq(authzMemberships.memberType, "user"),
        eq(authzMemberships.memberId, input.subjectId),
        or(
          eq(authzMemberships.subjectType, "team"),
          eq(authzMemberships.subjectType, "role")
        ),
        eq(authzMemberships.subjectType, authzTuples.subjectType),
        eq(authzMemberships.subjectId, authzTuples.subjectId)
      )
    )
    .where(and(
        subjectCondition,
        eq(authzTuples.relation, input.relation),
        eq(authzTuples.objectType, input.objectType),
        eq(authzTuples.objectId, input.objectId)
      ))
    .limit(1);

  return rows.length > 0;
}

export async function listObjects(
  db: DrizzleDb,
  subjectId: string,
  relation: Relation,
  objectType: ObjectType,
  subjectType: SubjectType = "user"
): Promise<string[]> {
  const rows = await db
    .select({ objectId: authzTuples.objectId })
    .from(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, subjectId),
        eq(authzTuples.relation, relation),
        eq(authzTuples.objectType, objectType)
      )
    );

  return rows.map((r) => r.objectId);
}

export async function listSubjects(
  db: DrizzleDb,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType?: SubjectType
): Promise<string[]> {
  const conditions = [
    eq(authzTuples.relation, relation),
    eq(authzTuples.objectType, objectType),
    eq(authzTuples.objectId, objectId),
  ];
  if (subjectType) conditions.push(eq(authzTuples.subjectType, subjectType));

  const rows = await db
    .select({ subjectId: authzTuples.subjectId })
    .from(authzTuples)
    .where(and(...conditions));

  return rows.map((r) => r.subjectId);
}
