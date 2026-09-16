import type { ToolDefinition } from "@kitstackco/sdk";

export type KitToolMode = "assist" | "act";

export interface KitToolMetadata {
  mode: KitToolMode;
  classification: string;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
  };
}

/** Attach v0.2 metadata without widening the shared SDK contract prematurely. */
export function withToolMetadata<T extends ToolDefinition>(
  tool: T,
  mode: KitToolMode,
  classification: string,
): T {
  Object.assign(tool, {
    mode,
    classification,
    annotations: {
      readOnlyHint: mode === "assist",
      destructiveHint: classification === "destructive",
    },
  });
  return tool;
}
