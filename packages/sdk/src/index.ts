// Types
export type {
  KitContext,
  StorageBinding,
  ConnectorRegistry,
  RequestIdentity,
  ChannelContext,
  ChannelKind,
  ChannelDefinition,
  SessionContext,
  TelemetryAttributes,
  TelemetrySink,
  AuditSink,
  Logger,
  KitToolResult,
  KitToolContentBlock,
  ToolDefinition,
  ViewDefinition,
  ViewHost,
  ViewHostKind,
  ViewHostSize,
  ViewHostTheme,
  ViewComponentProps,
  ViewRender,
  KitDefinition,
  JobDefinition,
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

// Provider-neutral storage boundary. Driver implementations live in kits or hosts.
export {
  assertStorageScope,
  requireStorageObjects,
  requireStorageSql,
  type StorageAdapter,
  type StorageObject,
  type StorageObjectAdapter,
  type StorageObjectInput,
  type StorageProvider,
  type StorageResult,
  type StorageScope,
  type StorageSqlAdapter,
  type StorageStatement,
  type StorageValue,
} from "./storage";

// Append-only, metadata-only audit storage
export {
  HashChainedAuditStore,
  assertMetadataOnlyAudit,
  canonicalAuditRecord,
  createHttpAuditExporter,
  hashAuditRecord,
  type AuditAttributeValue,
  type AuditAttributes,
  type AuditEventInput,
  type AuditOutcome,
  type AuditPersistence,
  type AuditQuery,
  type AuditRecord,
  type AuditStore,
  type AuditExportFormat,
  type AuditExporter,
  type AuditVerification,
  type HashChainedAuditStoreOptions,
  type HttpAuditExporterOptions,
} from "./audit";

// Metadata-only telemetry
export {
  assertMetadataOnlyTelemetry,
  createMetadataTelemetrySink,
  createOtlpHttpTelemetryExporter,
  createOtelTelemetryExporter,
  createTelemetryExporter,
  createTelemetryEvent,
  isMetadataOnlyTelemetry,
  type MetadataTelemetrySink,
  type OtlpHttpTelemetryExporterOptions,
  type OtelSpanData,
  type OtelSpanExporter,
  type TelemetryAttributeValue,
  type TelemetryEvent,
  type TelemetryEventInput,
  type TelemetryExportConfig,
  type TelemetryExporter,
  type TelemetryOutcome,
} from "./telemetry";

// Deterministic, explainable model routing
export {
  createDeclarativeModelRouter,
  type DeclarativeModelPolicy,
  type DeclarativeModelRouterOptions,
  type ModelRoute,
  type ModelRouteContext,
  type ModelTaskClass,
} from "./model-routing";

// Factory functions
export { defineKit } from "./define-kit";
export { defineTool } from "./define-tool";
export { defineView } from "./define-view";
export { defineLoader } from "./define-loader";
export { defineAgent } from "./define-agent";
export {
  createEval,
  type EvalConfig,
  type EvalDefinition,
  type EvalDelta,
  type EvalMeasurement,
  type EvalReport,
  type EvalScenario,
  type EvalScenarioResult,
  type EvalSurface,
  type PromotionOptions,
} from "./eval";
export {
  defineTrigger,
  dispatchTrigger,
  type TriggerKind,
  type TriggerIdentityType,
  type TriggerIdentity,
  type TriggerVerificationRequest,
  type TriggerContext,
  type TriggerDefinition,
  type TriggerInvocation,
  type TriggerAuditEvent,
  type TriggerDispatchOptions,
  type TriggerInvocationResult,
} from "./trigger";

export {
  dispatch,
  createDispatchEnvelope,
  type DispatchEnvelope,
  type DispatchRequestContext,
  type DispatchDependencies,
  type DispatchResult,
  type DispatchErrorCode,
  type DispatchTarget,
} from "./server/dispatch";
export {
  parseMcpServerManifest,
  resolveMcpPassthrough,
  McpManifestError,
  type McpServerManifest,
  type McpServerToolManifest,
  type McpPassthroughCall,
  type McpServerCallContext,
  type McpServerRegistration,
  withMcpServers,
} from "./server/manifest";
export { defineJob } from "./define-job";
export { createKitContext, type CreateKitContextOptions } from "./context";

// Jobs
export {
  createJobDispatchEnvelope,
  dispatchJob,
  jobIdentity,
  type ClaimJobInput,
  type CompleteJobInput,
  type FailJobInput,
  type JobDispatchInput,
  type JobLeaseOperations,
  type JobLeaseRecord,
  type JobLeaseStatus,
} from "./jobs";

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
