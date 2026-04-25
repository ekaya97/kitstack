import { Resource } from "sst";
import type { KitRegistryItem } from "../framework/types";

/**
 * Resolve the Lambda function identifier (ARN or name) for a kit.
 *
 * Looks up the SST Resource name from the registry's `lambdaResource` field,
 * then resolves the actual ARN/name from SST Resource bindings at runtime.
 *
 * Returns null if the kit has no Lambda configured or the resource isn't linked.
 */
export function getKitFunctionId(
  kitId: string,
  allTools: KitRegistryItem[]
): string | null {
  // Find any tool for this kit that has a lambdaResource value
  const tool = allTools.find((t) => t.kitId === kitId && t.lambdaResource);
  if (!tool?.lambdaResource) return null;

  const fn = (Resource as any)[tool.lambdaResource];
  if (!fn) return null;

  // In production: fn.arn is set. In sst dev: fn.name is the function name.
  return fn.arn ?? fn.name ?? null;
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
