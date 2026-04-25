/**
 * Local re-export of @kitstack/sdk.
 * All kit source files import from here.
 * When the real SDK ships, replace this with: export * from "../sdk"
 */
export {
  defineKit,
  defineTool,
  defineView,
  defineLoader,
  kit,
} from "../../../packages/sdk/src/index";

export type {
  KitContext,
  KitToolResult,
  KitDefinition,
  ToolDefinition,
  ViewDefinition,
  LoaderFn,
  LoaderData,
  Infer,
} from "../../../packages/sdk/src/index";
