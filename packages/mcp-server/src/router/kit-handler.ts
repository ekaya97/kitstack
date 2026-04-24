import type {
  KitRegistryItem,
  KitToolResult,
  McpToolDefinition,
  KitToolInput,
  UserKitDbItem,
} from "../framework/types";
import { Resource } from "sst";
import { dispatchToolCall } from "./tool-dispatcher";
import { getKitApps, readAppResource } from "./app-resources";

// View → data command mapping. The server tells the shell what tool to call for each view.
interface ViewDataConfig {
  cmd: string;
  params?: Record<string, unknown>;
  description: string; // when to show this view — used in discover
}

const VIEW_DATA: Record<string, Record<string, ViewDataConfig>> = {
  "cold-outreach": {
    "sequence-builder": { cmd: "list_sequences", description: "after creating or editing sequences and emails" },
    "prospect-list": { cmd: "list_sequences", description: "after adding prospects or updating hooks" },
    "email-preview": { cmd: "list_sequences", description: "to review email content before sending" },
  },
  crm: {
    pipeline: { cmd: "list_deals", description: "to see deal pipeline and stages" },
    contacts: { cmd: "list_contacts", description: "after adding or updating contacts" },
    "contact-detail": { cmd: "list_contacts", description: "to view detailed contact info" },
    dashboard: { cmd: "pipeline_dashboard", description: "for CRM metrics and activity overview" },
    proposal: { cmd: "list_deals", description: "to review deal proposals" },
  },
  "expense-tax-prep": {
    "expense-table": { cmd: "list_expenses", description: "after adding or importing expenses" },
    "category-dashboard": { cmd: "quarterly_summary", description: "for spending breakdown by category" },
    "import-review": { cmd: "list_expenses", description: "to review imported expenses" },
    "steuerberater-export": { cmd: "export_steuerberater", description: "to prepare tax advisor export" },
  },
  "meeting-action-tracker": {
    "meeting-summary": { cmd: "list_meetings", description: "after saving a meeting" },
    "action-tracker": { cmd: "list_actions", description: "to see open action items across meetings" },
    "meeting-history": { cmd: "list_meetings", description: "to browse past meetings" },
  },
};

/** Resource URI for the universal KitStack app shell. */
const APP_SHELL_URI = "ui://kitstack/app";

/**
 * Text-only tool for kit CRUD operations, discovery, and describe.
 * No _meta.ui — never renders an iframe.
 */
export const KIT_TOOL_DEFINITION: McpToolDefinition = {
  name: "kit",
  description: [
    "KitStack — persistent tool kits for AI. Works like a CLI:",
    "",
    "  kit()                    → list available kits",
    "  kit(id)                  → show actions in a kit",
    "  kit(id, cmd)             → describe an action's parameters",
    "  kit(id, cmd, params)     → run an action",
    "",
    "Start with kit() to see what's installed.",
    "To display interactive UI, use kit_view.",
  ].join("\n"),
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Kit ID, e.g. 'crm'" },
      cmd: { type: "string", description: "Action name, e.g. 'add_contact'" },
      params: { type: "object", description: "Action parameters" },
    },
  },
};

/**
 * Rendering companion to kit. Displays kit state as an interactive widget.
 * _meta.ui.resourceUri tells the host to preload the app shell.
 */
export const KIT_VIEW_TOOL_DEFINITION: McpToolDefinition = {
  name: "kit_view",
  description: [
    "Rendering companion to kit. Displays kit state as an interactive widget.",
    "Call kit_view(id) to discover available views for a kit.",
    "Use after state-changing kit operations when the user would benefit from seeing the result visually.",
    "For text results (CRUD operations, listings, exports), use kit directly.",
  ].join("\n"),
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Kit ID, e.g. 'cold-outreach'" },
      view: { type: "string", description: "View slug, e.g. 'sequence-builder'" },
    },
    required: ["id"],
  },
  _meta: {
    ui: { resourceUri: APP_SHELL_URI },
    "ui/resourceUri": APP_SHELL_URI,
  },
} as McpToolDefinition;

/**
 * Route a kit() call based on which params are present.
 */
export async function handleKitCall(
  input: KitToolInput,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  const { id, cmd, params } = input;

  // kit() → list kits
  if (!id) {
    return handleListKits(userId, getAllTools, getUserKitDbs);
  }

  const allTools = await getAllTools();
  const [userDbs] = await Promise.all([getUserKitDbs(userId)]);
  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));

  if (!activatedKitIds.has(id)) {
    return {
      content: [{ type: "text", text: `Kit "${id}" is not activated. Run kit() to see available kits.` }],
      isError: true,
    };
  }

  const kitTools = allTools.filter(
    (t) => t.kitId === id && !t.toolName.startsWith("kitstack_")
  );

  if (kitTools.length === 0) {
    return {
      content: [{ type: "text", text: `Kit "${id}" has no tools registered.` }],
      isError: true,
    };
  }

  // kit(id) → discover
  if (!cmd) {
    return handleDiscover(id, kitTools);
  }

  // show_app moved to kit_view tool — redirect if someone calls it here
  if (cmd === "show_app") {
    return {
      content: [{ type: "text", text: `Use kit_view(id="${id}", view="...") to display interactive UI.` }],
    };
  }

  // kit(id, cmd) → describe
  if (!params) {
    return handleDescribe(id, cmd, kitTools);
  }

  // kit(id, cmd, params) → run
  return handleRun(id, cmd, params, userId, allTools, invokeKitLambda);
}

/**
 * Handle kit_view() calls — the rendering companion to kit().
 * kit_view(id) → list available views
 * kit_view(id, view) → render the view as an embedded resource
 */
export async function handleKitViewCall(
  args: { id?: string; view?: string },
  userId: string,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>
): Promise<KitToolResult> {
  if (!args.id) {
    return {
      content: [{ type: "text", text: `Provide a kit ID. Use kit() to see available kits.` }],
      isError: true,
    };
  }

  const userDbs = await getUserKitDbs(userId);
  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));

  if (!activatedKitIds.has(args.id)) {
    return {
      content: [{ type: "text", text: `Kit "${args.id}" is not activated.` }],
      isError: true,
    };
  }

  // No view specified → text-only discovery (no iframe)
  if (!args.view) {
    const apps = getKitApps(args.id);
    if (!apps.length) {
      return { content: [{ type: "text", text: `Kit "${args.id}" has no views.` }] };
    }
    const viewData = VIEW_DATA[args.id];
    const list = apps
      .map((a) => {
        const vd = viewData?.[a.slug];
        return vd ? `- \`${a.slug}\`: ${a.name} — ${vd.description}` : `- \`${a.slug}\`: ${a.name}`;
      })
      .join("\n");
    return {
      content: [{
        type: "text",
        text: `## Available Views\n\n${list}\n\n**Usage:** \`kit_view(id="${args.id}", view="${apps[0].slug}")\``,
      }],
    };
  }

  // View specified → render the iframe
  return handleShowApp(args.id, { view: args.view }, userId, activatedKitIds);
}

// --- List Kits ---

async function handleListKits(
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>
): Promise<KitToolResult> {
  const [allTools, userDbs] = await Promise.all([
    getAllTools(),
    getUserKitDbs(userId),
  ]);

  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));

  // Group tools by kit, only for activated kits
  const kits = new Map<string, { name: string; description: string; actionCount: number }>();
  for (const tool of allTools) {
    if (!activatedKitIds.has(tool.kitId)) continue;
    if (tool.toolName.startsWith("kitstack_")) continue;

    const existing = kits.get(tool.kitId);
    if (existing) {
      existing.actionCount++;
    } else {
      kits.set(tool.kitId, {
        name: tool.kitName,
        description: tool.kitDescription || tool.kitName,
        actionCount: 1,
      });
    }
  }

  if (kits.size === 0) {
    return {
      content: [{
        type: "text",
        text: "No kits activated. Visit kitstack.co/dashboard to activate kits.",
      }],
    };
  }

  let text = `## Your Kits\n\n`;
  text += "| ID | Name | Description | Actions |\n";
  text += "|-----|------|-------------|--------:|\n";
  for (const [kitId, kit] of kits) {
    text += `| \`${kitId}\` | ${kit.name} | ${kit.description} | ${kit.actionCount} |\n`;
  }
  text += `\n**Next:** \`kit(id="<kit-id>")\` to see a kit's actions.`;

  return { content: [{ type: "text", text }] };
}

// --- Discover ---

function handleDiscover(
  kitId: string,
  kitTools: KitRegistryItem[]
): KitToolResult {
  const kit = kitTools[0];
  let text = `## ${kit.kitName}\n\n`;
  if (kit.kitDescription) {
    text += `${kit.kitDescription}\n\n`;
  }

  text += "### Actions\n\n";
  text += "| Action | Description |\n";
  text += "|--------|-------------|\n";
  for (const tool of kitTools) {
    const schema = JSON.parse(tool.inputSchema);
    const hasRequired = schema.required && schema.required.length > 0;
    text += `| \`${tool.toolName}\` | ${tool.toolDescription} |\n`;
  }

  // Point to kit_view for interactive UI
  const apps = getKitApps(kitId);
  const viewData = VIEW_DATA[kitId];
  if (apps.length > 0 && viewData) {
    const viewList = apps
      .map((a) => {
        const vd = viewData[a.slug];
        return vd ? `\`${a.slug}\` — ${vd.description}` : `\`${a.slug}\``;
      })
      .join("; ");
    text += `\n**Interactive UI:** \`kit_view(id="${kitId}", view="...")\` — ${viewList}\n`;
  }

  text += "\n**Run directly:** `kit(id=\"" + kitId + "\", cmd=\"<action>\", params={...})`\n";
  text += "**Describe first:** `kit(id=\"" + kitId + "\", cmd=\"<action>\")` to see parameter schema";

  return { content: [{ type: "text", text }] };
}

// --- Describe ---

function handleDescribe(
  kitId: string,
  cmd: string,
  kitTools: KitRegistryItem[]
): KitToolResult {
  const tool = kitTools.find((t) => t.toolName === cmd);
  if (!tool) {
    const available = kitTools.map((t) => t.toolName).join(", ");
    return {
      content: [{ type: "text", text: `Unknown action "${cmd}". Available: ${available}` }],
      isError: true,
    };
  }

  let text = `## ${tool.toolName}\n\n`;
  text += `${tool.toolDescription}\n\n`;
  text += "### Parameters\n\n";
  text += "```json\n";
  text += JSON.stringify(JSON.parse(tool.inputSchema), null, 2);
  text += "\n```\n\n";
  text += `**Run:** \`kit(id="${kitId}", cmd="${tool.toolName}", params={...})\``;

  return { content: [{ type: "text", text }] };
}

// --- Show App ---

async function handleShowApp(
  kitId: string,
  params: Record<string, unknown>,
  userId: string,
  activatedKitIds: Set<string>
): Promise<KitToolResult> {
  const view = params.view as string | undefined;
  const apps = getKitApps(kitId);

  if (!apps.length) {
    return {
      content: [{ type: "text", text: `Kit "${kitId}" has no apps.` }],
      isError: true,
    };
  }

  // If no view specified, show available apps
  if (!view) {
    const list = apps.map((a) => `- \`${a.slug}\`: ${a.name}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `## Available Views\n\n${list}\n\n**Usage:** \`kit_view(id="${kitId}", view="${apps[0].slug}")\``,
      }],
    };
  }

  const app = apps.find((a) => a.slug === view);
  if (!app) {
    const available = apps.map((a) => a.slug).join(", ");
    return {
      content: [{ type: "text", text: `Unknown app "${view}". Available: ${available}` }],
      isError: true,
    };
  }

  // Resolve what data command this view needs
  const viewConfig = VIEW_DATA[kitId]?.[app.slug];
  const dataPayload = JSON.stringify({
    kit: kitId,
    view: app.slug,
    app: app.name,
    cmd: viewConfig?.cmd ?? "list_sequences",
    params: viewConfig?.params ?? {},
  });

  // EmbeddedResource block with the app shell HTML.
  // The text block carries structured JSON that the shell parses to know what data to fetch.
  const viewUri = `ui://kitstack/${kitId}/${app.slug}`;
  const resource = await readAppResource(APP_SHELL_URI, userId, activatedKitIds);

  if (!resource) {
    return {
      content: [{ type: "text", text: `App "${app.name}" is not available.` }],
      isError: true,
    };
  }

  const shellHtml = resource.text;

  return {
    content: [
      { type: "text", text: dataPayload },
      {
        type: "resource" as const,
        resource: {
          uri: viewUri,
          mimeType: "text/html;profile=mcp-app",
          text: shellHtml,
        },
      },
    ],
  } as any;
}

// --- Run ---

async function handleRun(
  kitId: string,
  cmd: string,
  params: Record<string, unknown>,
  userId: string,
  allTools: KitRegistryItem[],
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  return dispatchToolCall(
    cmd,
    params,
    userId,
    async () => allTools,
    invokeKitLambda
  ) as Promise<KitToolResult>;
}
