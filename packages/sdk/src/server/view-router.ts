import type { KitToolResult, KitToolContentBlock } from "../types";
import type { KitServerAdapter, ResolvedKit } from "./types";

/**
 * Route a kit_view() call through the adapter.
 *
 * kit_view(id)        → list available views for a kit
 * kit_view(id, view)  → render the view as an embedded resource
 */
export async function handleKitViewCall(
  args: { id?: string; view?: string },
  userId: string,
  adapter: KitServerAdapter
): Promise<KitToolResult> {
  if (!args.id) {
    return error("Provide a kit ID. Use kit() to see available kits.");
  }

  const kits = await adapter.resolveUserKits(userId);
  const kit = kits.find((k) => k.id === args.id);

  if (!kit) {
    return error(`Kit "${args.id}" is not activated.`);
  }

  // kit_view(id) → list views
  if (!args.view) {
    return handleListViews(kit);
  }

  // kit_view(id, view) → render
  return handleRenderView(kit, args.view, userId, adapter);
}

// --- List Views ---

function handleListViews(kit: ResolvedKit): KitToolResult {
  if (kit.views.length === 0) {
    return text(`Kit "${kit.id}" has no views.`);
  }

  const list = kit.views
    .map((v) => `- \`${v.slug}\`: ${v.name} \u2014 ${v.description}`)
    .join("\n");

  return text(
    `## Available Views\n\n${list}\n\n**Usage:** \`kit_view(id="${kit.id}", view="${kit.views[0].slug}")\``
  );
}

// --- Render View ---

async function handleRenderView(
  kit: ResolvedKit,
  viewSlug: string,
  userId: string,
  adapter: KitServerAdapter
): Promise<KitToolResult> {
  const view = kit.views.find((v) => v.slug === viewSlug);
  if (!view) {
    const available = kit.views.map((v) => v.slug).join(", ");
    return error(`Unknown view "${viewSlug}". Available: ${available}`);
  }

  // Execute the loader
  let loaderData: unknown = null;
  try {
    loaderData = await adapter.executeLoader(kit.id, viewSlug, userId);
  } catch (err: any) {
    console.error(`[kit_view] Loader failed for ${kit.id}/${viewSlug}:`, err.message);
  }

  // Get shell HTML
  const shellHtml = await adapter.getShellHtml(kit.id);
  if (!shellHtml) {
    return error(`View "${view.name}" is not available.`);
  }

  const dataPayload = JSON.stringify({
    kit: kit.id,
    view: view.slug,
    app: view.name,
    data: loaderData,
  });

  const viewUri = `ui://kitstack/${kit.id}/${view.slug}`;

  const content: KitToolContentBlock[] = [
    { type: "text", text: dataPayload },
    {
      type: "resource" as any,
      resource: {
        uri: viewUri,
        mimeType: "text/html;profile=mcp-app",
        text: shellHtml,
      },
    } as any,
  ];

  return { content };
}

// --- Helpers ---

function text(t: string): KitToolResult {
  return { content: [{ type: "text", text: t }] };
}

function error(t: string): KitToolResult {
  return { content: [{ type: "text", text: t }], isError: true };
}
