// Types
export type {
  KitContext,
  StorageBinding,
  ConnectorRegistry,
  RequestIdentity,
  ChannelContext,
  SessionContext,
  TelemetryAttributes,
  TelemetrySink,
  AuditSink,
  Logger,
  KitToolResult,
  KitToolContentBlock,
  ToolDefinition,
  ViewDefinition,
  KitDefinition,
  KitToolInvocation,
  KitToolInput,
  LoaderFn,
  LoaderData,
  Infer,
  AuthzRequirement,
  AgentInstructions,
  AgentTrigger,
  AgentSession,
  AgentInput,
  AgentMessage,
  AgentToolDefinition,
  AgentTurnMetadata,
  AgentModelResponse,
  AgentModelTurn,
  AgentModelConnector,
  AgentTurnSource,
  AgentOutput,
  AgentOutputSink,
  AgentLifecycleEvent,
  AgentLifecycleHooks,
  AgentRunStatus,
  AgentRunError,
  AgentRunResult,
  DefineAgentConfig,
  AgentDefinition,
} from "./types";

// Factory functions
export { defineKit } from "./define-kit";
export { defineTool } from "./define-tool";
export { defineView } from "./define-view";
export { defineLoader } from "./define-loader";
export { defineAgent } from "./define-agent";
export { createKitContext, type CreateKitContextOptions } from "./context";

// Connectors
export {
  bindConnector,
  createRestOpenApiConnector,
  type Connector,
  type ConnectorBinding,
  type ConnectorManifest,
  type ConnectorSecretResolver,
  type ConnectorSecretStore,
  type RestOpenApiClient,
  type RestOpenApiConfig,
  type RestOpenApiRequest,
} from "./connectors";

// Plugins
export {
  PluginRegistry,
  PluginRegistryError,
  type Plugin,
  type PluginContext,
  type PluginManifest,
  type PluginRegisteredEvent,
  type PluginRegistrationHook,
  type PluginRegistryEvent,
  type PluginRegistryOptions,
} from "./plugins";

// Result helpers
export { kit, type KitResultFragment } from "./result";

// Errors
export {
  KitStackError,
  KitValidationError,
  ToolValidationError,
  MigrationError,
  SchemaError,
  AuthError,
} from "./errors";
