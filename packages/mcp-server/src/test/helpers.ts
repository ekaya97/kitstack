import type { KitToolResult } from "../framework/types";

/** Extract text from the first content block of a tool result. */
export function textOf(result: KitToolResult): string {
  const block = result.content[0];
  if (block.type === "text") return block.text;
  throw new Error(`Expected text block, got ${block.type}`);
}
