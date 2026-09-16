/** Scalar values safe to attach to metadata-only telemetry. */
export type TelemetryAttributeValue = string | number | boolean | null;

export type TelemetryOutcome = "success" | "error" | "started" | "partial";

/**
 * The SDK-owned metadata contract shared by hosts and kits.
 *
 * This is intentionally a metadata-only shape. It has no prompt, completion,
 * audio, transcript, tool argument, or tool result fields. Identity fields are
 * nullable because boot events may happen before an app or authenticated actor
 * exists; `createTelemetryEvent` supplies the stable null defaults.
 */
export interface TelemetryEvent {
  id: string;
  timestamp: string;
  orgId: string;
  appId: string | null;
  principal: string | null;
  actor: string | null;
  delegation: string | null;
  sessionId: string | null;
  traceId: string | null;
  parentId: string | null;
  channel: string;
  kitId: string | null;
  pluginId: string | null;
  operation: string;
  type: string;
  provider: string | null;
  model: string | null;
  callId: string | null;
  requestTokens: number | null;
  responseTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  routingReason: string | null;
  cancellationReason: string | null;
  timeoutReason: string | null;
  outcome: TelemetryOutcome;
  instructionVersions: readonly string[] | undefined;
  memoryIds: readonly string[] | undefined;
}

type OptionalTelemetryField =
  | "appId"
  | "principal"
  | "actor"
  | "delegation"
  | "sessionId"
  | "traceId"
  | "parentId"
  | "kitId"
  | "pluginId"
  | "provider"
  | "model"
  | "callId"
  | "requestTokens"
  | "responseTokens"
  | "latencyMs"
  | "estimatedCostUsd"
  | "routingReason"
  | "cancellationReason"
  | "timeoutReason"
  | "instructionVersions"
  | "memoryIds";

/** Input accepted by a metadata sink; required event identity is kept small. */
export type TelemetryEventInput =
  Pick<TelemetryEvent, "id" | "timestamp" | "orgId" | "channel" | "operation" | "type" | "outcome">
  & Partial<Pick<TelemetryEvent, OptionalTelemetryField>>;

/** A sink for normalized metadata events. */
export interface MetadataTelemetrySink {
  append(input: TelemetryEventInput): Promise<TelemetryEvent>;
}

const CONTENT_FIELDS = new Set([
  "prompt",
  "completion",
  "audio",
  "transcript",
  "toolPayload",
  "toolArgs",
  "toolArguments",
  "toolResult",
  "toolOutput",
]);

/**
 * Runtime guard for the retention boundary. It checks nested values as well
 * so a provider-specific envelope cannot smuggle content through attributes.
 */
export function isMetadataOnlyTelemetry(value: unknown): value is TelemetryEventInput {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.timestamp !== "string" || typeof value.orgId !== "string") return false;
  if (typeof value.channel !== "string" || typeof value.operation !== "string" || typeof value.type !== "string") return false;
  if (!isTelemetryOutcome(value.outcome)) return false;
  return !containsContentField(value, new Set());
}

/** Throws before a sink can normalize or persist a content-bearing object. */
export function assertMetadataOnlyTelemetry(value: unknown): asserts value is TelemetryEventInput {
  if (!isMetadataOnlyTelemetry(value)) {
    throw new TypeError("Telemetry events must contain metadata only; prompts, completions, audio, transcripts, and tool payloads are not accepted");
  }
}

/** Normalize optional metadata fields without retaining caller-owned objects. */
export function createTelemetryEvent(input: TelemetryEventInput): TelemetryEvent {
  assertMetadataOnlyTelemetry(input);
  return {
    id: input.id,
    timestamp: input.timestamp,
    orgId: input.orgId,
    appId: input.appId ?? null,
    principal: input.principal ?? null,
    actor: input.actor ?? null,
    delegation: input.delegation ?? null,
    sessionId: input.sessionId ?? null,
    traceId: input.traceId ?? null,
    parentId: input.parentId ?? null,
    channel: input.channel,
    kitId: input.kitId ?? null,
    pluginId: input.pluginId ?? null,
    operation: input.operation,
    type: input.type,
    provider: input.provider ?? null,
    model: input.model ?? null,
    callId: input.callId ?? null,
    requestTokens: input.requestTokens ?? null,
    responseTokens: input.responseTokens ?? null,
    latencyMs: input.latencyMs ?? null,
    estimatedCostUsd: input.estimatedCostUsd ?? null,
    routingReason: input.routingReason ?? null,
    cancellationReason: input.cancellationReason ?? null,
    timeoutReason: input.timeoutReason ?? null,
    outcome: input.outcome,
    instructionVersions: input.instructionVersions === undefined ? undefined : [...input.instructionVersions],
    memoryIds: input.memoryIds === undefined ? undefined : [...input.memoryIds],
  };
}

/** Exporter shape intentionally avoids an OpenTelemetry package dependency. */
export interface TelemetryExporter {
  export(event: TelemetryEvent): void | Promise<void>;
}

/** Minimal SpanData-compatible shape accepted by the OTel adapter seam. */
export interface OtelSpanData {
  name: string;
  startTime: [number, number];
  endTime: [number, number];
  traceId: string | null;
  parentSpanId: string | null;
  attributes: Readonly<Record<string, TelemetryAttributeValue | readonly string[]>>;
  status: { code: "UNSET" | "OK" | "ERROR"; message?: string };
}

export interface OtelSpanExporter {
  export(
    spans: readonly OtelSpanData[],
    result: (result: { code: "success" | "failed"; error?: Error }) => void,
  ): void;
}

/**
 * Adapt metadata events to an OTel-compatible exporter without exporting
 * content. A host can wrap the returned span in its installed OTel SDK.
 */
export function createOtelTelemetryExporter(exporter: OtelSpanExporter): TelemetryExporter {
  return {
    export(event) {
      const span = toOtelSpanData(event);
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (result: { code: "success" | "failed"; error?: Error }) => {
          if (settled) return;
          settled = true;
          if (result.code === "success") resolve();
          else reject(result.error ?? new Error("Telemetry exporter failed"));
        };
        try {
          exporter.export([span], finish);
        } catch (error) {
          finish({ code: "failed", error: error instanceof Error ? error : new Error(String(error)) });
        }
      });
    },
  };
}

/** Create a sink that normalizes events before forwarding them to an exporter. */
export function createMetadataTelemetrySink(exporter: TelemetryExporter): MetadataTelemetrySink {
  return {
    async append(input) {
      const event = createTelemetryEvent(input);
      await exporter.export(event);
      return event;
    },
  };
}

function toOtelSpanData(event: TelemetryEvent): OtelSpanData {
  const startTime = toHrTime(event.timestamp);
  const endTime = toHrTime(new Date(Date.parse(event.timestamp) + (event.latencyMs ?? 0)).toISOString());
  const attributes: Record<string, TelemetryAttributeValue | readonly string[]> = {
    "kitstack.event_type": event.type,
    "kitstack.org_id": event.orgId,
    "kitstack.channel": event.channel,
    "kitstack.operation": event.operation,
    "kitstack.outcome": event.outcome,
  };
  addAttribute(attributes, "kitstack.app_id", event.appId);
  addAttribute(attributes, "kitstack.principal", event.principal);
  addAttribute(attributes, "kitstack.actor", event.actor);
  addAttribute(attributes, "kitstack.delegation", event.delegation);
  addAttribute(attributes, "kitstack.session_id", event.sessionId);
  addAttribute(attributes, "kitstack.kit_id", event.kitId);
  addAttribute(attributes, "kitstack.plugin_id", event.pluginId);
  addAttribute(attributes, "kitstack.provider", event.provider);
  addAttribute(attributes, "kitstack.model", event.model);
  addAttribute(attributes, "kitstack.call_id", event.callId);
  addAttribute(attributes, "kitstack.request_tokens", event.requestTokens);
  addAttribute(attributes, "kitstack.response_tokens", event.responseTokens);
  addAttribute(attributes, "kitstack.latency_ms", event.latencyMs);
  addAttribute(attributes, "kitstack.estimated_cost_usd", event.estimatedCostUsd);
  addAttribute(attributes, "kitstack.routing_reason", event.routingReason);
  addAttribute(attributes, "kitstack.cancellation_reason", event.cancellationReason);
  addAttribute(attributes, "kitstack.timeout_reason", event.timeoutReason);
  if (event.parentId !== null) attributes["kitstack.parent_id"] = event.parentId;
  if (event.traceId !== null) attributes["kitstack.trace_id"] = event.traceId;
  if (event.instructionVersions !== undefined) attributes["kitstack.instruction_versions"] = event.instructionVersions;
  if (event.memoryIds !== undefined) attributes["kitstack.memory_ids"] = event.memoryIds;
  return {
    name: `${event.kitId ?? "kitstack"}.${event.operation}`,
    startTime,
    endTime,
    traceId: event.traceId,
    parentSpanId: event.parentId,
    attributes,
    status: { code: event.outcome === "error" ? "ERROR" : event.outcome === "started" ? "UNSET" : "OK" },
  };
}

function toHrTime(timestamp: string): [number, number] {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) throw new TypeError("Telemetry timestamps must be valid ISO dates");
  const seconds = Math.floor(milliseconds / 1000);
  return [seconds, (milliseconds - seconds * 1000) * 1_000_000];
}

function addAttribute(
  target: Record<string, TelemetryAttributeValue | readonly string[]>,
  key: string,
  value: TelemetryAttributeValue,
): void {
  if (value !== null) target[key] = value;
}

function isTelemetryOutcome(value: unknown): value is TelemetryOutcome {
  return value === "success" || value === "error" || value === "started" || value === "partial";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function containsContentField(value: unknown, seen: Set<object>): boolean {
  if (!isRecord(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (CONTENT_FIELDS.has(key)) return true;
    if (isRecord(nested) && containsContentField(nested, seen)) return true;
    if (Array.isArray(nested) && nested.some((item) => containsContentField(item, seen))) return true;
  }
  return false;
}
