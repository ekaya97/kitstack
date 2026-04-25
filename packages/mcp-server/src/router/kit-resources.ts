import type { KitRegistryItem } from "./types";

/**
 * Resolve the Lambda function name for a kit.
 *
 * Uses the `Kit-{kitId}` naming convention. Kit Lambdas are provisioned
 * dynamically via `provisionKitLambda()` from `@kitstack/sdk/deploy`,
 * not hardcoded in SST config.
 *
 * Falls back to the registry's `lambdaResource` field if present, for
 * backwards compatibility with kits deployed before the convention was
 * adopted.
 */
export function getKitFunctionId(
  kitId: string,
  allTools: KitRegistryItem[]
): string | null {
  // Check if the registry specifies a custom Lambda resource name
  const tool = allTools.find((t) => t.kitId === kitId && t.lambdaResource);
  if (tool?.lambdaResource) {
    return tool.lambdaResource;
  }

  // Convention: all kit Lambdas are named Kit-{kitId}
  return `Kit-${kitId}`;
}

/**
 * Derive the authz slug for a kit.
 *
 * Convention: kitId + "-kit" suffix.
 * e.g. "crm" → "crm-kit", "cold-outreach" → "cold-outreach-kit"
 */
export function getKitAuthzSlug(kitId: string): string {
  return `${kitId}-kit`;
}
