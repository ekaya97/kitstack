export { authzTuples } from "./schema";
export { check, listObjects, listSubjects } from "./engine";
export { grantRelation, revokeRelation, revokeAllForSubject } from "./lifecycle";
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
} from "./types";
export type { AuthorizeResult } from "./middleware";
