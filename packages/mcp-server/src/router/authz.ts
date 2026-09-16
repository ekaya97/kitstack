import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { authorize } from "../../../authz/src/middleware";
import { check } from "../../../authz/src/engine";
import type {
  AuthzRequirement,
  Relation,
  ObjectType,
  SubjectType,
} from "../../../authz/src/types";
import { verifyAccessToken } from "../router/oauth/helpers";
import { tursoDbUrl, tursoAuthToken } from "../config";
import { log } from "../router/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export type McpToolMode = "assist" | "act";
export type McpIdentityKind = "interactive" | "delegated" | "service";

/** Identity carried by a router request into authorization. */
export interface McpRequestIdentity {
  /** The user or service whose resources are addressed. */
  principal: string;
  /** The identity executing the request. */
  actor: string;
  kind: McpIdentityKind;
  /** Required for delegated execution; normally a short-lived delegation id. */
  delegation?: string;
}

export interface ToolAuthorizationInput {
  identity: McpRequestIdentity;
  mode: McpToolMode;
  kitSlug: string;
}

export interface ToolAuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export type TupleChecker = (
  subjectId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType?: SubjectType,
) => Promise<boolean>;

export function interactiveIdentity(userId: string): McpRequestIdentity {
  return { principal: userId, actor: userId, kind: "interactive" };
}

/**
 * Authorize one tool call against the platform grant vocabulary.
 *
 * Assist reads require `kit:use`; autonomous act calls require `kit:act`.
 * Delegated calls are an intersection: both the user principal and the
 * service actor need the same grant. A service identity must be explicit and
 * cannot smuggle a user principal into the service path.
 */
export async function authorizeToolInvocation(
  input: ToolAuthorizationInput,
  tupleChecker: TupleChecker = mcpCheckTuple,
): Promise<ToolAuthorizationResult> {
  const { identity, mode, kitSlug } = input;
  const relation: Relation = mode === "act" ? "kit:act" : "kit:use";

  if (identity.kind === "interactive") {
    if (identity.principal !== identity.actor) {
      return { allowed: false, reason: "Interactive identity actor must equal principal" };
    }
    const allowed = await tupleChecker(identity.principal, relation, "kit", kitSlug, "user");
    return allowed
      ? { allowed: true }
      : { allowed: false, reason: `Missing ${relation} on kit:${kitSlug}` };
  }

  if (identity.kind === "service") {
    if (identity.principal !== identity.actor) {
      return { allowed: false, reason: "Service identity cannot impersonate a user principal" };
    }
    const allowed = await tupleChecker(identity.actor, relation, "kit", kitSlug, "service");
    return allowed
      ? { allowed: true }
      : { allowed: false, reason: `Missing ${relation} on kit:${kitSlug} for service identity` };
  }

  if (!identity.delegation || identity.principal === identity.actor) {
    return { allowed: false, reason: "Delegated identity requires a distinct actor and delegation" };
  }

  const principalAllowed = await tupleChecker(
    identity.principal,
    relation,
    "kit",
    kitSlug,
    "user",
  );
  if (!principalAllowed) {
    return { allowed: false, reason: `Missing ${relation} on kit:${kitSlug} for principal` };
  }

  const actorAllowed = await tupleChecker(
    identity.actor,
    relation,
    "kit",
    kitSlug,
    "service",
  );
  return {
    allowed: actorAllowed,
    reason: actorAllowed
      ? undefined
      : `Missing ${relation} on kit:${kitSlug} for service actor`,
  };
}

/** Lazily create a Drizzle client for the main Turso DB (shared by authz + registry). */
export function getTursoDb() {
  if (!_db) {
    const client = createClient({
      url: tursoDbUrl(),
      authToken: tursoAuthToken(),
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
      log.warn("Authorization denied", { userId, reason: result.reason });
      throw new Error(result.reason ?? "Forbidden");
    }
  }

  return { userId };
}

/**
 * Check a single tuple from the MCP side.
 * Useful for tool-level authorization against the platform grant vocabulary.
 */
export async function mcpCheckTuple(
  userId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType: SubjectType = "user",
): Promise<boolean> {
  const db = getTursoDb();
  const result = await check(db, {
    subjectId: userId,
    subjectType,
    relation,
    objectType,
    objectId,
  });
  if (!result.allowed) {
    log.debug("Tuple check denied", { userId, relation, objectType, objectId });
  }
  return result.allowed;
}
