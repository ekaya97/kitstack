import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { getViewsForKit } from "../db/dynamo";
import { kitCdnUrl, kitAssetsBucket, appDataUrl } from "../config";

const s3 = new S3Client({});

/** The single app shell resource URI. Declared in KIT_TOOL_DEFINITION._meta.ui. */
export const APP_SHELL_URI = "ui://kitstack/app";

// ── Kit → App mapping (from registry) ──────

export interface KitApp {
  name: string;
  slug: string;
  description: string;
}

// ── S3 fetch with in-memory cache ──────────────────────────────

const htmlCache = new Map<string, string>();

async function fetchFromS3(s3Key: string): Promise<string | null> {
  if (htmlCache.has(s3Key)) return htmlCache.get(s3Key)!;

  const bucket = kitAssetsBucket();
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

  const cdnUrl = kitCdnUrl();
  const appDataVal = appDataUrl();
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
            ...(appDataVal ? [appDataVal] : []),
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

    const cdnUrl = kitCdnUrl();
    const appDataVal = appDataUrl();
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
              ...(appDataVal ? [appDataVal] : []),
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
 * Get apps/views for a kit from the kit_views registry table.
 */
export async function getKitApps(kitId: string): Promise<KitApp[]> {
  const views = await getViewsForKit(kitId);
  return views.map((v) => ({
    name: v.viewName,
    slug: v.viewSlug,
    description: v.viewDescription,
  }));
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
