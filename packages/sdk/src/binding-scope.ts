/**
 * Host-owned scope metadata shared by provider-neutral bindings.
 *
 * Scope is routing and authorization metadata, not provider configuration. It
 * is deliberately small so the same boundary works for local and remote
 * implementations without introducing a connector catalog.
 */
export interface BindingScope {
  /** Organization or tenant that owns the binding. */
  readonly orgId: string;
  /** Kit allowed to use the binding. */
  readonly kitId: string;
  /** Optional provider tenant when an org maps to multiple upstream tenants. */
  readonly tenantId?: string;
}

export function assertBindingScope(scope: BindingScope, label = "binding scope"): void {
  if (!scope || typeof scope !== "object") throw new Error(`${label} is required`);
  if (!scope.orgId.trim()) throw new Error(`${label} orgId must not be empty`);
  if (!scope.kitId.trim()) throw new Error(`${label} kitId must not be empty`);
  if (scope.tenantId !== undefined && !scope.tenantId.trim()) {
    throw new Error(`${label} tenantId must not be empty when supplied`);
  }
}

export function assertBindingScopeMatches(
  actual: BindingScope,
  expected: BindingScope,
  label = "binding scope",
): void {
  assertBindingScope(actual, label);
  assertBindingScope(expected, "requested scope");
  if (actual.orgId !== expected.orgId || actual.kitId !== expected.kitId || actual.tenantId !== expected.tenantId) {
    throw new Error(`${label} does not match the requested org/kit scope`);
  }
}
