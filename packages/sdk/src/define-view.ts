import type { ViewDefinition, LoaderFn } from "./types";

/**
 * Define a view for interactive UI rendering via MCP Apps.
 *
 * Views appear in the `kit_view` tool. The LLM chooses when to show them
 * based on the `description` field. The `loader` runs on the server to
 * produce typed data; the `component` renders it in a sandboxed iframe.
 *
 * The `component` import is used at build time to locate the React source
 * file. At runtime, the build pipeline bundles it as a standalone ES module
 * loaded by the app shell.
 *
 * @example
 * ```typescript
 * // views/contacts/index.ts (CRM kit)
 * import { defineView } from "@kitstack/sdk";
 * import { loader } from "./loader";
 * import { ContactsView } from "./View";
 *
 * export default defineView({
 *   slug: "contacts",
 *   name: "Contacts",
 *   description: "after adding or updating contacts",
 *   loader,
 *   component: ContactsView,
 *   height: 500,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // views/pipeline/index.ts — kanban board with drag-and-drop
 * import { defineView } from "@kitstack/sdk";
 * import { loader } from "./loader";
 * import { PipelineView } from "./View";
 *
 * export default defineView({
 *   slug: "pipeline",
 *   name: "Deal Pipeline",
 *   description: "to see deal pipeline and stages",
 *   loader,
 *   component: PipelineView,
 *   height: 600,
 *   permissions: { clipboardWrite: true },
 * });
 * ```
 */
export function defineView<TLoader extends LoaderFn>(config: {
  slug: string;
  name: string;
  description: string;
  loader: TLoader;
  component: React.ComponentType<{ data: Awaited<ReturnType<TLoader>> }>;
  height?: number;
  permissions?: {
    clipboardWrite?: boolean;
  };
}): ViewDefinition<TLoader> {
  return config;
}
