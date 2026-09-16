import { describe, expect, it, vi } from "vitest";
import {
  assertMetadataOnlyTelemetry,
  createMetadataTelemetrySink,
  createOtelTelemetryExporter,
  createTelemetryEvent,
  isMetadataOnlyTelemetry,
  type TelemetryEventInput,
} from "../src/telemetry";

function event(overrides: Partial<TelemetryEventInput> = {}): TelemetryEventInput {
  return {
    id: "event-1",
    timestamp: "2026-09-16T10:00:00.000Z",
    orgId: "org-demo",
    appId: "app-sales",
    principal: "user-1",
    actor: "agent-1",
    delegation: "delegation-1",
    sessionId: "session-1",
    traceId: "trace-1",
    parentId: "parent-1",
    channel: "voice",
    kitId: "kit:debrief",
    pluginId: "inference:openai",
    type: "inference",
    operation: "realtime_turn",
    provider: "openai",
    model: "gpt-realtime",
    requestTokens: 12,
    responseTokens: 8,
    estimatedCostUsd: 0.0002,
    latencyMs: 120,
    outcome: "success",
    ...overrides,
  };
}

describe("SDK metadata telemetry", () => {
  it("normalizes the complete correlation and usage contract", () => {
    const normalized = createTelemetryEvent(event());

    expect(normalized).toMatchObject({
      orgId: "org-demo",
      appId: "app-sales",
      principal: "user-1",
      actor: "agent-1",
      delegation: "delegation-1",
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
      channel: "voice",
      kitId: "kit:debrief",
      pluginId: "inference:openai",
      operation: "realtime_turn",
      model: "gpt-realtime",
      requestTokens: 12,
      responseTokens: 8,
      estimatedCostUsd: 0.0002,
      latencyMs: 120,
      outcome: "success",
    });
    expect(normalized).not.toHaveProperty("prompt");
  });

  it("rejects content-bearing fields, including nested provider envelopes", () => {
    const contentEvent = { ...event(), providerMetadata: { transcript: "never retain" } };

    expect(isMetadataOnlyTelemetry(contentEvent)).toBe(false);
    expect(() => assertMetadataOnlyTelemetry(contentEvent)).toThrow(/metadata only/);
    expect(() => createTelemetryEvent({ ...event(), toolPayload: { secret: true } } as TelemetryEventInput & Record<string, unknown>)).toThrow(/metadata only/);
  });

  it("normalizes before forwarding to a metadata exporter", async () => {
    const exporter = { export: vi.fn(async () => undefined) };
    const sink = createMetadataTelemetrySink(exporter);

    const normalized = await sink.append(event({ appId: undefined, parentId: undefined }));

    expect(normalized).toMatchObject({ appId: null, parentId: null, principal: "user-1" });
    expect(exporter.export).toHaveBeenCalledWith(normalized);
  });

  it("provides a dependency-free OTel exporter seam with metadata-only attributes", async () => {
    const spans: unknown[] = [];
    const exporter = createOtelTelemetryExporter({
      export(batch, result) {
        spans.push(...batch);
        result({ code: "success" });
      },
    });

    await exporter.export(createTelemetryEvent(event()));

    expect(spans[0]).toMatchObject({
      name: "kit:debrief.realtime_turn",
      traceId: "trace-1",
      parentSpanId: "parent-1",
      status: { code: "OK" },
      attributes: {
        "kitstack.org_id": "org-demo",
        "kitstack.principal": "user-1",
        "kitstack.actor": "agent-1",
        "kitstack.request_tokens": 12,
      },
    });
    expect(JSON.stringify(spans)).not.toMatch(/prompt|completion|audio|transcript|toolPayload/i);
  });
});
