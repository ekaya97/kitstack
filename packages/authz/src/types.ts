export type SubjectType = "user" | "team";
export type Relation = "subscriber" | "activator" | "author";
export type ObjectType = "subscription" | "kit" | "review";

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
