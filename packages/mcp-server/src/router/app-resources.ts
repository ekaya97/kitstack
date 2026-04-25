import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { getViewsForKit, type KitViewItem } from "../framework/dynamo";

function getCdnUrl(): string {
  return (Resource as any).KitCdn?.url?.replace(/\/$/, "") || "";
}

const s3 = new S3Client({});

/** The single app shell resource URI. Declared in KIT_TOOL_DEFINITION._meta.ui. */
export const APP_SHELL_URI = "ui://kitstack/app";

// ── Kit → App mapping (legacy hardcoded, used as fallback) ──────

interface KitApp {
  name: string;
  slug: string;
}

const KIT_APPS_FALLBACK: Record<string, KitApp[]> = {
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

// ── S3 fetch with in-memory cache ──────────────────────────────

const htmlCache = new Map<string, string>();

async function fetchFromS3(s3Key: string): Promise<string | null> {
  if (htmlCache.has(s3Key)) return htmlCache.get(s3Key)!;

  const bucket = (Resource as any).KitAssets?.name;
  console.log(`[AppResources] Fetching s3://${bucket}/${s3Key}`);

  if (!bucket) {
    console.error("[AppResources] KitAssets bucket not linked");
    return null;
  }

  try {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    );
    const content = await result.Body!.transformToString();
    console.log(`[AppResources] Loaded ${s3Key} (${content.length} bytes)`);
    htmlCache.set(s3Key, content);
    return content;
  } catch (err: any) {
    console.error(`[AppResources] S3 fetch failed: ${err.message}`);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────

export function listAppResources(activatedKitIds: Set<string>) {
  const resources: Array<{
    uri: string;
    name: string;
    mimeType: string;
  }> = [];

  const cdnUrl = getCdnUrl();
  const appDataUrl = (Resource as any).AppData?.url?.replace(/\/$/, "") || "";
  resources.push({
    uri: APP_SHELL_URI,
    name: "KitStack App",
    mimeType: RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        csp: {
          resourceDomains: [
            ...(cdnUrl ? [cdnUrl] : []),
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com",
          ],
          connectDomains: [
            ...(cdnUrl ? [cdnUrl] : []),
            ...(appDataUrl ? [appDataUrl] : []),
          ],
        },
        permissions: { clipboardWrite: {} },
      },
    },
  } as any);

  return resources;
}

/**
 * Read the app shell HTML for a kit.
 * If the kit has a generated shell in the registry (shell_s3_key), use that.
 * Otherwise fall back to the universal app-shell.html.
 */
export async function readAppResource(
  uri: string,
  userId: string,
  activatedKitIds: Set<string>,
  kitShellS3Key?: string | null
): Promise<{ uri: string; mimeType: string; text: string; _meta?: any } | null> {
  if (uri === APP_SHELL_URI) {
    // Prefer kit-specific generated shell if available
    const s3Key = kitShellS3Key || "apps/app-shell.html";
    const html = await fetchFromS3(s3Key);
    if (!html) return null;

    const cdnUrl = getCdnUrl();
    const appDataUrl = (Resource as any).AppData?.url?.replace(/\/$/, "") || "";
    return {
      uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: html,
      _meta: {
        ui: {
          csp: {
            resourceDomains: [
              ...(cdnUrl ? [cdnUrl] : []),
              "https://fonts.googleapis.com",
              "https://fonts.gstatic.com",
            ],
            connectDomains: [
              ...(cdnUrl ? [cdnUrl] : []),
              ...(appDataUrl ? [appDataUrl] : []),
            ],
          },
          permissions: { clipboardWrite: {} },
        },
      },
    };
  }

  return null;
}

/**
 * Get apps/views for a kit.
 * Reads from the kit_views registry table. Falls back to hardcoded map for legacy kits.
 */
export async function getKitApps(kitId: string): Promise<KitApp[]> {
  // Try registry first
  const views = await getViewsForKit(kitId);
  if (views.length > 0) {
    return views.map((v) => ({ name: v.viewName, slug: v.viewSlug }));
  }
  // Fallback for legacy kits not yet in registry
  return KIT_APPS_FALLBACK[kitId] || [];
}

/**
 * Get the shell S3 key for a kit from the registry.
 * Returns null if the kit uses the universal shell.
 */
export async function getKitShellS3Key(kitId: string): Promise<string | null> {
  const views = await getViewsForKit(kitId);
  // All views for a kit share the same shell
  return views[0]?.shellS3Key ?? null;
}
