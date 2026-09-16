/** Subjects that can receive a platform grant or participate in membership. */
export type SubjectType =
  | "organization"
  | "team"
  | "role"
  | "application"
  | "user"
  | "service"
  | "delegated";

/** Platform authorization scopes. */
export type Relation =
  | "kit:use"
  | "kit:act"
  | "kit:deploy"
  | "kit:telemetry"
  | "kit:admin"
  | "platform:admin";

/** Resource kinds on which platform grants are evaluated. */
export type ObjectType = "organization" | "kit" | "platform" | "application";

export interface AuthzTuple {
  subjectType: SubjectType;
  subjectId: string;
  relation: Relation;
  objectType: ObjectType;
  objectId: string;
}

export interface CheckInput {
  subjectType?: SubjectType;
  subjectId: string;
  relation: Relation;
  objectType: ObjectType;
  objectId: string;
}

export interface CheckResult {
  allowed: boolean;
  reason?: string;
}

export interface AuthzContext {
  userId: string;
}

export interface AuthzRequirement {
  relation: Relation;
  objectType: ObjectType;
  objectId: string;
}

/** One-hop membership used to resolve a user through a team or role grant. */
export interface SubjectMembership {
  memberType: SubjectType;
  memberId: string;
  subjectType: "team" | "role";
  subjectId: string;
}

export type IdentityMappingType = "group" | "app-role";

/** Maps an Entra group or app-role claim to a KitStack grant subject. */
export interface IdentityMapping {
  provider: string;
  tenantId: string;
  mappingType: IdentityMappingType;
  claimValue: string;
  subjectType: SubjectType;
  subjectId: string;
}

export interface AuthzVersion {
  id: 1;
  version: number;
}

export interface AuthzCacheOptions {
  /** Decision cache lifetime. Defaults to ten minutes. */
  ttlMs?: number;
  /** Injectable clock for deterministic latency and expiry tests. */
  now?: () => number;
}

export const AUTHZ_CACHE_TTL_MS = 10 * 60 * 1000;
