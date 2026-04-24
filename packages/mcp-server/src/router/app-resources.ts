import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const s3 = new S3Client({});

/** The single app shell resource URI. Declared in KIT_TOOL_DEFINITION._meta.ui. */
export const APP_SHELL_URI = "ui://kitstack/app";

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

// ── S3 fetch with in-memory cache ──────────────────────────────

const htmlCache = new Map<string, string>();

async function fetchFromS3(s3Key: string): Promise<string | null> {
  if (htmlCache.has(s3Key)) return htmlCache.get(s3Key)!;

  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: (Resource as any).KitAssets.name,
        Key: s3Key,
      })
    );
    const content = await result.Body!.transformToString();
    htmlCache.set(s3Key, content);
    return content;
  } catch {
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

  // Always include the universal app shell
  resources.push({
    uri: APP_SHELL_URI,
    name: "KitStack App",
    mimeType: RESOURCE_MIME_TYPE,
  });

  return resources;
}

export async function readAppResource(
  uri: string,
  userId: string,
  activatedKitIds: Set<string>
): Promise<{ uri: string; mimeType: string; text: string } | null> {
  // Universal app shell
  if (uri === APP_SHELL_URI) {
    const html = await fetchFromS3("apps/app-shell.html");
    if (!html) return null;
    return { uri, mimeType: RESOURCE_MIME_TYPE, text: html };
  }

  return null;
}

export function getKitApps(kitId: string): KitApp[] {
  return KIT_APPS[kitId] || [];
}

