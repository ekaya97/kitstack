export { authzTuples, authzMemberships, authzIdentityMappings, authzVersion } from "./schema";
export { check, listObjects, listSubjects } from "./engine";
export { VersionedGrantCache } from "./engine";
export {
  grantRelation,
  revokeRelation,
  revokeAllForSubject,
  grantMembership,
  revokeMembership,
  revokeAllMembershipsForMember,
  grantIdentityMapping,
  revokeIdentityMapping,
  listIdentityMappings,
} from "./lifecycle";
export { getAuthorizationVersion, bumpAuthorizationVersion } from "./version";
export { authorize } from "./middleware";
export { canActivateKit } from "./policies";
export type {
  SubjectType,
  Relation,
  ObjectType,
  AuthzTuple,
  CheckInput,
  CheckResult,
  AuthzContext,
  AuthzRequirement,
  SubjectMembership,
  AuthzVersion,
  AuthzCacheOptions,
  IdentityMappingType,
  IdentityMapping,
} from "./types";
export { AUTHZ_CACHE_TTL_MS } from "./types";
export type { AuthorizeResult } from "./middleware";
