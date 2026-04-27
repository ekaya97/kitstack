import type { KitToolResult } from "../types";
import type { KitServerAdapter, ResolvedKit } from "./types";

/**
 * Route a kit() call through the adapter.
 *
 * kit()                    → list available kits
 * kit(id)                  → show actions in a kit
 * kit(id, cmd)             → describe an action's parameters
 * kit(id, cmd, params)     → run an action
 */
export async function handleKitCall(
  args: { id?: string; cmd?: string; params?: Record<string, unknown> },
  userId: string,
  adapter: KitServerAdapter
): Promise<KitToolResult> {
  const { id, cmd, params } = args;

  const kits = await adapter.resolveUserKits(userId);

  // kit() → list kits
  if (!id) {
    return handleListKits(kits);
  }

  const kit = kits.find((k) => k.id === id);
  if (!kit) {
    return error(`Kit "${id}" is not activated. Run kit() to see available kits.`);
  }

  // kit(id) → discover actions
  if (!cmd) {
    return handleDiscover(kit);
  }

  // kit(id, cmd, "__load_view") — internal: reload view data
  if (cmd === "__load_view" && params?.view) {
    try {
      const data = await adapter.executeLoader(id, params.view as string, userId);
      return text(JSON.stringify({ data }));
    } catch (err: any) {
      return text(JSON.stringify({ data: null, error: err.message }));
    }
  }

  // kit(id, cmd) → describe parameters
  if (!params) {
    return handleDescribe(kit, cmd);
  }

  // kit(id, cmd, params) → run
  return adapter.executeTool(id, cmd, params, userId);
}

// --- List Kits ---

function handleListKits(kits: ResolvedKit[]): KitToolResult {
  if (kits.length === 0) {
    return text("No kits activated. Visit kitstack.co/dashboard to activate kits.");
  }

  let md = `## Your Kits\n\n`;
  md += "| ID | Name | Description | Actions |\n";
  md += "|-----|------|-------------|--------:|\n";
  for (const kit of kits) {
    md += `| \`${kit.id}\` | ${kit.name} | ${kit.description} | ${kit.tools.length} |\n`;
  }
  md += `\n**Next:** \`kit(id="<kit-id>")\` to see a kit's actions.`;

  return text(md);
}

// --- Discover ---

function handleDiscover(kit: ResolvedKit): KitToolResult {
  let md = `## ${kit.name}\n\n`;
  if (kit.description) {
    md += `${kit.description}\n\n`;
  }

  md += "### Actions\n\n";
  md += "| Action | Description |\n";
  md += "|--------|-------------|\n";
  for (const tool of kit.tools) {
    md += `| \`${tool.name}\` | ${tool.description} |\n`;
  }

  if (kit.views.length > 0) {
    const viewList = kit.views
      .map((v) => `\`${v.slug}\` \u2014 ${v.description}`)
      .join("; ");
    md += `\n**Interactive UI:** \`kit_view(id="${kit.id}", view="...")\` \u2014 ${viewList}\n`;
  }

  md += `\n**Run directly:** \`kit(id="${kit.id}", cmd="<action>", params={...})\`\n`;
  md += `**Describe first:** \`kit(id="${kit.id}", cmd="<action>")\` to see parameter schema`;

  return text(md);
}

// --- Describe ---

function handleDescribe(kit: ResolvedKit, cmd: string): KitToolResult {
  const tool = kit.tools.find((t) => t.name === cmd);
  if (!tool) {
    const available = kit.tools.map((t) => t.name).join(", ");
    return error(`Unknown action "${cmd}". Available: ${available}`);
  }

  let md = `## ${tool.name}\n\n${tool.description}\n\n`;
  md += `### Parameters\n\n\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\`\n\n`;
  md += `**Run:** \`kit(id="${kit.id}", cmd="${tool.name}", params={...})\``;

  return text(md);
}

// --- Helpers ---

function text(t: string): KitToolResult {
  return { content: [{ type: "text", text: t }] };
}

function error(t: string): KitToolResult {
  return { content: [{ type: "text", text: t }], isError: true };
}
