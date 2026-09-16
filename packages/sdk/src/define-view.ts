import { createElement } from "react";
import type {
  ViewComponentProps,
  ViewDefinition,
  ViewRender,
  LoaderFn,
} from "./types";

type ViewMetadata<TData> = {
  name: string;
  description: string;
  height?: number;
  permissions?: { clipboardWrite?: boolean };
  placeholder?: TData;
};

type PublicViewConfig<TLoader extends LoaderFn> = ViewMetadata<Awaited<ReturnType<TLoader>>> & {
  id: string;
  loaders: readonly [TLoader];
  render: ViewRender<Awaited<ReturnType<TLoader>>>;
};

type LegacyViewConfig<TLoader extends LoaderFn> = ViewMetadata<Awaited<ReturnType<TLoader>>> & {
  slug: string;
  loader: TLoader;
  component: React.ComponentType<ViewComponentProps<Awaited<ReturnType<TLoader>>>>;
};

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
export function defineView<TLoader extends LoaderFn>(
  config: PublicViewConfig<TLoader>
): ViewDefinition<TLoader>;

/** @deprecated Use `id`, `loaders`, and `render(data, host)` for new Views. */
export function defineView<TLoader extends LoaderFn>(
  config: LegacyViewConfig<TLoader>
): ViewDefinition<TLoader>;

export function defineView<TLoader extends LoaderFn>(
  config: PublicViewConfig<TLoader> | LegacyViewConfig<TLoader>
): ViewDefinition<TLoader> {
  if ("id" in config) {
    const loader = config.loaders[0];
    const component = (props: ViewComponentProps<Awaited<ReturnType<TLoader>>>) =>
      config.render(props.data, props.host);
    return {
      ...config,
      slug: config.id,
      loader,
      component,
    };
  }

  const render: ViewRender<Awaited<ReturnType<TLoader>>> = (data, host) =>
    createElement(config.component, { data, host });
  return {
    ...config,
    id: config.slug,
    loaders: [config.loader],
    render,
  };
}
