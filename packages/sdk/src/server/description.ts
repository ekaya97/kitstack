import type { ResolvedKit } from "./types";

/**
 * Build a compact, front-loaded `kit` tool description optimized for
 * deferred tool search. The first line contains kit names and trigger
 * keywords so BM25 search can match user intent even before the full
 * description is loaded.
 *
 * @param kits - The user's resolved kits
 * @returns The tool description string
 */
export function buildDynamicKitDescription(kits: ResolvedKit[]): string {
  if (kits.length === 0) {
    return "KitStack \u2014 persistent tool kits for AI. No kits activated yet. Call kit() to get started.";
  }

  const totalActions = kits.reduce((sum, k) => sum + k.tools.length, 0);

  // Scale triggers per kit based on count to keep first line compact
  const maxTriggers = kits.length <= 5 ? 10 : kits.length <= 10 ? 2 : 1;
  const kitSummaries = kits
    .map((k) => {
      const t = k.triggers.slice(0, maxTriggers).join(", ");
      return t ? `${k.id} (${t})` : k.id;
    })
    .join(", ");

  const firstLine = `KitStack \u2014 ${kits.length} apps, ${totalActions} tools in one surface. ${kitSummaries}. Call kit() to see all capabilities.`;

  const cliLine = "kit() \u2192 list kits, kit(id) \u2192 actions, kit(id, cmd) \u2192 params, kit(id, cmd, params) \u2192 run.";

  const actionLines = kits.map(
    (k) => `${k.id}: ${k.tools.map((t) => t.name).join(", ")}`
  );

  return [firstLine, cliLine, ...actionLines].join("\n");
}

/**
 * Build concatenated kit instructions for the MCP `initialize` response.
 * Returns null if no kits have instructions.
 *
 * @param kits - The user's resolved kits
 * @returns Concatenated instructions or null
 */
export function buildKitInstructions(kits: ResolvedKit[]): string | null {
  const blocks = kits
    .map((k) => k.instructions)
    .filter((i): i is string => !!i);

  if (blocks.length === 0) return null;
  return blocks.join("\n\n---\n\n");
}
