/**
 * Seeds the kit_views and kit_registry tables in Turso from a build manifest.
 *
 * After uploading build artifacts to S3, run this to register the kit's
 * tools and views with the McpRouter so they appear in `tools/list` and
 * the `kit_view` tool.
 *
 * Upserts rows (INSERT OR REPLACE) so re-running is safe and idempotent.
 *
 * @module
 */

import { createClient, type Client } from "@libsql/client";

/**
 * Manifest shape produced by `buildKit()` at `.kitstack/build/manifest.json`.
 */
export interface KitManifest {
  kitId: string;
  kitName: string;
  version: string;
  tools: Array<{ name: string; description: string }>;
  views: Array<{ slug: string; name: string; description: string }>;
  migrationSql: string;
}

/**
 * Options for {@link seedRegistry}.
 */
export interface SeedRegistryOptions {
  /** Turso database URL for the platform registry. */
  tursoUrl: string;
  /** Turso auth token. */
  tursoToken: string;
  /** The build manifest from `.kitstack/build/manifest.json`. */
  manifest: KitManifest;
  /** S3 key for the kit's app shell (e.g. "apps/kits/crm/shell.html"). */
  shellS3Key?: string;
  /** SST Resource name for the kit's Lambda (e.g. "CrmKitLambda"). */
  lambdaResource?: string;
  /** Default view height in pixels. */
  defaultHeight?: number;
}

/**
 * Seed the kit_views and kit_registry tables from a build manifest.
 *
 * Upserts all tools into `kit_registry` and all views into `kit_views`.
 * Safe to run multiple times — uses INSERT OR REPLACE.
 *
 * @param options - Registry connection and manifest data
 *
 * @example
 * ```typescript
 * // In a deploy script (run via `npx sst shell -- npx tsx deploy.ts`)
 * import { seedRegistry } from "@kitstack/sdk/deploy/seed-registry";
 * import manifest from "./.kitstack/build/manifest.json";
 *
 * await seedRegistry({
 *   tursoUrl: process.env.TURSO_URL!,
 *   tursoToken: process.env.TURSO_TOKEN!,
 *   manifest,
 *   shellS3Key: "apps/kits/crm/shell.html",
 *   lambdaResource: "CrmKitLambda",
 * });
 * ```
 */
export async function seedRegistry(options: SeedRegistryOptions): Promise<void> {
  const {
    tursoUrl,
    tursoToken,
    manifest,
    shellS3Key,
    lambdaResource,
    defaultHeight = 400,
  } = options;

  const client = createClient({ url: tursoUrl, authToken: tursoToken });

  try {
    // Seed kit_registry (tools)
    for (const tool of manifest.tools) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO kit_registry (kit_id, tool_name, tool_description, input_schema, kit_name, kit_description, lambda_resource)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          manifest.kitId,
          tool.name,
          tool.description,
          "{}",  // input_schema — populated by the router from Zod at runtime
          manifest.kitName,
          manifest.kitName,
          lambdaResource ?? null,
        ],
      });
    }

    console.log(`  ✓ Seeded ${manifest.tools.length} tools into kit_registry`);

    // Seed kit_views
    for (const view of manifest.views) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO kit_views (kit_id, view_slug, view_name, view_description, height, shell_s3_key)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          manifest.kitId,
          view.slug,
          view.name,
          view.description,
          defaultHeight,
          shellS3Key ?? null,
        ],
      });
    }

    console.log(`  ✓ Seeded ${manifest.views.length} views into kit_views`);
  } finally {
    client.close();
  }
}
