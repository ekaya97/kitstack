import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resource } from "sst";
import { signAppToken } from "../framework/app-token";
import type { UserKitDbItem } from "../framework/types";

// ── Kit → App mapping ───────────────────────────────────────────

interface KitApp {
  name: string;
  slug: string;
}

const KIT_APPS: Record<string, KitApp[]> = {
  crm: [
    { name: "Pipeline", slug: "pipeline" },
    { name: "Contacts", slug: "contacts" },
    { name: "Contact Detail", slug: "contact-detail" },
    { name: "Dashboard", slug: "dashboard" },
    { name: "Proposal", slug: "proposal" },
  ],
  "cold-outreach": [
    { name: "Sequence Builder", slug: "sequence-builder" },
    { name: "Prospect List", slug: "prospect-list" },
    { name: "Email Preview", slug: "email-preview" },
  ],
  "expense-tax-prep": [
    { name: "Expense Table", slug: "expense-table" },
    { name: "Category Dashboard", slug: "category-dashboard" },
    { name: "Import Review", slug: "import-review" },
    { name: "Steuerberater Export", slug: "steuerberater-export" },
  ],
  "meeting-action-tracker": [
    { name: "Meeting Summary", slug: "meeting-summary" },
    { name: "Action Tracker", slug: "action-tracker" },
    { name: "Meeting History", slug: "meeting-history" },
  ],
};

// Kit ID → folder name in dist-inline/
const KIT_FOLDER: Record<string, string> = {
  crm: "crm",
  "cold-outreach": "outreach",
  "expense-tax-prep": "expense",
  "meeting-action-tracker": "meeting",
};

// ── Tool → App mapping (write tools that trigger UI) ────────────

const TOOL_APP_MAP: Record<string, { kitId: string; appSlug: string }> = {
  // CRM
  add_contact: { kitId: "crm", appSlug: "contacts" },
  update_contact: { kitId: "crm", appSlug: "contact-detail" },
  add_deal: { kitId: "crm", appSlug: "pipeline" },
  update_deal_stage: { kitId: "crm", appSlug: "pipeline" },
  log_activity: { kitId: "crm", appSlug: "dashboard" },
  create_proposal: { kitId: "crm", appSlug: "proposal" },
  // Outreach
  create_sequence: { kitId: "cold-outreach", appSlug: "sequence-builder" },
  generate_emails: { kitId: "cold-outreach", appSlug: "sequence-builder" },
  edit_email: { kitId: "cold-outreach", appSlug: "sequence-builder" },
  add_prospect: { kitId: "cold-outreach", appSlug: "prospect-list" },
  personalize_for_prospect: { kitId: "cold-outreach", appSlug: "prospect-list" },
  // Expense
  add_expense: { kitId: "expense-tax-prep", appSlug: "expense-table" },
  import_expenses: { kitId: "expense-tax-prep", appSlug: "import-review" },
  quarterly_summary: { kitId: "expense-tax-prep", appSlug: "category-dashboard" },
  // Meeting
  save_meeting: { kitId: "meeting-action-tracker", appSlug: "meeting-summary" },
  add_action_item: { kitId: "meeting-action-tracker", appSlug: "action-tracker" },
  update_action_status: { kitId: "meeting-action-tracker", appSlug: "action-tracker" },
  add_decision: { kitId: "meeting-action-tracker", appSlug: "meeting-summary" },
};

// ── HTML cache ──────────────────────────────────────────────────

const htmlCache = new Map<string, string>();

function getAppHtml(kitId: string, appSlug: string): string | null {
  const key = `${kitId}/${appSlug}`;
  if (htmlCache.has(key)) return htmlCache.get(key)!;

  const folder = KIT_FOLDER[kitId];
  if (!folder) return null;

  try {
    const htmlPath = resolve(
      process.cwd(),
      "packages/mcp-server/src/router/app-html",
      folder,
      `${appSlug}.html`
    );
    const html = readFileSync(htmlPath, "utf-8");
    htmlCache.set(key, html);
    return html;
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────

export function getResourceUri(kitId: string, appSlug: string): string {
  return `ui://kitstack/${kitId}/${appSlug}`;
}

export function getToolAppUri(toolName: string): string | null {
  const mapping = TOOL_APP_MAP[toolName];
  if (!mapping) return null;
  return getResourceUri(mapping.kitId, mapping.appSlug);
}

export function listAppResources(activatedKitIds: Set<string>) {
  const resources: Array<{
    uri: string;
    name: string;
    mimeType: string;
  }> = [];

  for (const [kitId, apps] of Object.entries(KIT_APPS)) {
    if (!activatedKitIds.has(kitId)) continue;
    for (const app of apps) {
      resources.push({
        uri: getResourceUri(kitId, app.slug),
        name: app.name,
        mimeType: "text/html;profile=mcp-app",
      });
    }
  }

  return resources;
}

export async function readAppResource(
  uri: string,
  userId: string,
  activatedKitIds: Set<string>
): Promise<{ uri: string; mimeType: string; text: string } | null> {
  // Parse uri: ui://kitstack/{kitId}/{appSlug}
  const match = uri.match(/^ui:\/\/kitstack\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  const [, kitId, appSlug] = match;

  if (!activatedKitIds.has(kitId)) return null;

  const html = getAppHtml(kitId, appSlug);
  if (!html) return null;

  // Generate a JWT token for this user + kit
  const token = await signAppToken({ sub: userId, kit: kitId });
  const appDataUrl = (Resource as any).AppData?.url?.replace(/\/$/, "") || "";

  // Inject config into the HTML <head>
  const configScript = `<script>window.__KITSTACK__=${JSON.stringify({
    token,
    appDataUrl,
    kit: kitId,
  })}</script>`;

  const injectedHtml = html.replace("</head>", `${configScript}</head>`);

  return {
    uri,
    mimeType: "text/html;profile=mcp-app",
    text: injectedHtml,
  };
}

export function getKitApps(kitId: string): KitApp[] {
  return KIT_APPS[kitId] || [];
}
