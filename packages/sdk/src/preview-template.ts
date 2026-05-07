/**
 * Generates a self-contained preview HTML page for a single kit view.
 *
 * The preview embeds placeholder data and loads view assets via relative
 * paths (works on any CDN domain). Used by the build pipeline to produce
 * static preview pages uploaded to S3 alongside view bundles.
 *
 * @module
 */

export interface PreviewConfig {
  /** Kit identifier (e.g. "crm"). */
  kitId: string;
  /** View slug (e.g. "pipeline"). */
  viewSlug: string;
  /** Placeholder/sample data to bake into the page. */
  placeholderData: unknown;
}

/**
 * Generate a self-contained preview HTML string for a view.
 *
 * Loads vendor.js, shared.js, the view module, and style.css via relative
 * paths from the expected S3 layout:
 *   apps/kits/{kitId}/previews/{viewSlug}.html
 *   apps/kits/{kitId}/{kitId}/{viewSlug}.js
 *   apps/kits/{kitId}/vendor.js
 *   apps/kits/{kitId}/shared.js
 *   apps/kits/{kitId}/style.css
 *
 * @param config - Preview configuration with kit ID, view slug, and data
 * @returns Complete HTML string ready to be written to disk
 */
export function generatePreview(config: PreviewConfig): string {
  const { kitId, viewSlug, placeholderData } = config;
  const dataJson = JSON.stringify(placeholderData);
  const key = `${kitId}/${viewSlug}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="../style.css">
<style>
  .ks-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #6b6357; }
  .ks-error { padding: 16px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }
</style>
</head>
<body>
<div id="root"><div class="ks-loading">Loading preview...</div></div>
<script type="module">
const KIT_KEY = ${JSON.stringify(key)};
const DATA = ${dataJson};

async function boot() {
  try {
    await import("../vendor.js");
    await import("../shared.js");
    await import("../${key}.js");

    const views = window.__KITSTACK_VIEWS__;
    if (views?.[KIT_KEY]) {
      const root = document.getElementById("root");
      root.innerHTML = "";
      views[KIT_KEY].mount(root, DATA);
    }
  } catch (err) {
    console.error("[KitStack Preview]", err);
    document.getElementById("root").innerHTML =
      '<div class="ks-error">Preview failed to load: ' + err.message + '</div>';
  }
}

boot();
</script>
</body>
</html>`;
}
