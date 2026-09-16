import {
  bearerToken,
  type AppRegistry,
  type AppTokenClaims,
} from "../auth/index.js";
import type { TelemetryEventInput } from "../../telemetry/index.js";

export interface TelemetrySink {
  append(event: TelemetryEventInput): Promise<unknown>;
}

export interface ProxyOptions {
  registry: AppRegistry;
  upstream: (request: Request) => Response | Promise<Response>;
  telemetry: TelemetrySink;
  requiredScope?: string;
  now?: () => number;
  createEventId?: () => string;
}

export interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

/** Small, explicit pricing table for the demo; values are USD per 1M tokens. */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  "gpt-4o": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 },
};

export interface ProxyUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ProxyResult {
  response: Response;
  identity: AppTokenClaims;
}

const COMPLETIONS_PATH = "/v1/chat/completions";

/**
 * A deliberately thin OpenAI-compatible proxy. The upstream is injected so
 * the demo can use a local simulator and never needs provider credentials.
 */
export async function handleProxyRequest(
  request: Request,
  options: ProxyOptions,
): Promise<ProxyResult> {
  if (request.method !== "POST") {
    return { response: json({ error: "Method not allowed" }, 405), identity: emptyIdentity() };
  }
  if (new URL(request.url).pathname !== COMPLETIONS_PATH) {
    return { response: json({ error: "Not found" }, 404), identity: emptyIdentity() };
  }

  const rawToken = bearerToken(request);
  if (!rawToken) return { response: json({ error: "Bearer token required" }, 401), identity: emptyIdentity() };

  let identity: AppTokenClaims;
  try {
    identity = await options.registry.verify(rawToken);
  } catch {
    return { response: json({ error: "Invalid or expired bearer token" }, 401), identity: emptyIdentity() };
  }

  const requiredScope = options.requiredScope ?? "inference";
  if (!identity.scopes.includes(requiredScope)) {
    return { response: json({ error: "Token does not grant inference scope" }, 403), identity };
  }

  const startedAt = (options.now ?? Date.now)();
  const requestDetails = await readRequestDetails(request);
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete("authorization");
  upstreamHeaders.set("x-kitstack-app-id", identity.sub);
  upstreamHeaders.set("x-kitstack-org", identity.org);
  upstreamHeaders.set("x-kitstack-scopes", identity.scopes.join(" "));
  upstreamHeaders.set("x-kitstack-identity", identity.sub);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await options.upstream(new Request(request, { headers: upstreamHeaders }));
  } catch (error) {
    await emitInference(options, identity, requestDetails, {
      model: requestDetails.model,
      requestTokens: requestDetails.promptTokens,
      responseTokens: null,
      latencyMs: elapsed(options, startedAt),
      estimatedCostUsd: cost(requestDetails.model, requestDetails.promptTokens, 0),
      outcome: "error",
      requestId: requestDetails.requestId,
    });
    return {
      response: json({ error: error instanceof Error ? error.message : "Upstream request failed" }, 502),
      identity,
    };
  }

  if (!upstreamResponse.body || !isStreaming(upstreamResponse)) {
    const usage = await readJsonUsage(upstreamResponse);
    const responseTokens = usage?.completion_tokens ?? requestDetails.completionTokens;
    const requestTokens = usage?.prompt_tokens ?? requestDetails.promptTokens;
    await emitInference(options, identity, requestDetails, {
      model: requestDetails.model,
      requestTokens,
      responseTokens,
      latencyMs: elapsed(options, startedAt),
      estimatedCostUsd: cost(requestDetails.model, requestTokens, responseTokens),
      outcome: upstreamResponse.ok ? "success" : "error",
      requestId: requestDetails.requestId,
    });
    return { response: upstreamResponse, identity };
  }

  // Observe one tee while returning the other immediately. The caller gets
  // the original stream unchanged; only transient counters are accumulated.
  const [forward, observed] = upstreamResponse.body.tee();
  void observeStreamingResponse(observed, options, identity, requestDetails, startedAt, upstreamResponse);
  return {
    response: new Response(forward, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    }),
    identity,
  };
}

async function observeStreamingResponse(
  body: ReadableStream<Uint8Array>,
  options: ProxyOptions,
  identity: AppTokenClaims,
  details: RequestDetails,
  startedAt: number,
  upstreamResponse: Response,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: ProxyUsage | undefined;
  let completionTextLength = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parseSseLine(line);
        if (!parsed) continue;
        usage = parsed.usage ?? usage;
        completionTextLength += parsed.contentLength;
      }
    }
    buffer += decoder.decode();
    const final = parseSseLine(buffer);
    if (final) {
      usage = final.usage ?? usage;
      completionTextLength += final.contentLength;
    }
    const responseTokens = usage?.completion_tokens
      ?? details.completionTokens
      ?? estimateTokens(completionTextLength);
    const requestTokens = usage?.prompt_tokens ?? details.promptTokens;
    await emitInference(options, identity, details, {
      model: details.model,
      requestTokens,
      responseTokens,
      latencyMs: elapsed(options, startedAt),
      estimatedCostUsd: cost(details.model, requestTokens, responseTokens),
      outcome: upstreamResponse.ok ? "success" : "error",
      requestId: details.requestId,
    });
  } catch {
    await emitInference(options, identity, details, {
      model: details.model,
      requestTokens: details.promptTokens,
      responseTokens: null,
      latencyMs: elapsed(options, startedAt),
      estimatedCostUsd: cost(details.model, details.promptTokens, 0),
      outcome: "error",
      requestId: details.requestId,
    });
  }
}

interface RequestDetails {
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  requestId: string | null;
  sessionId: string | null;
  parentId: string | null;
  traceId: string | null;
}

async function readRequestDetails(request: Request): Promise<RequestDetails> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.clone().json() as Record<string, unknown>;
  } catch {
    // The upstream still receives the original body and will report malformed input.
  }
  const messages = Array.isArray(body.messages) ? body.messages : body;
  return {
    model: typeof body.model === "string" ? body.model : "gpt-4o-mini",
    promptTokens: estimateTokens(messages),
    completionTokens: null,
    requestId: request.headers.get("x-request-id"),
    sessionId: request.headers.get("x-kitstack-session-id"),
    parentId: request.headers.get("x-kitstack-parent-id"),
    traceId: request.headers.get("x-kitstack-trace-id"),
  };
}

async function readJsonUsage(response: Response): Promise<ProxyUsage | undefined> {
  const headerUsage = response.headers.get("x-usage");
  if (headerUsage) {
    const parsed = parseUsage(headerUsage);
    if (parsed) return parsed;
  }
  try {
    const payload = await response.clone().json() as { usage?: unknown; choices?: unknown };
    const usage = parseUsage(payload.usage);
    if (usage) return usage;
    return {
      completion_tokens: estimateTokens(payload.choices ?? payload),
    };
  } catch {
    return undefined;
  }
}

function parseSseLine(line: string): { usage?: ProxyUsage; contentLength: number } | null {
  if (!line.startsWith("data:")) return null;
  const data = line.slice("data:".length).trim();
  if (!data || data === "[DONE]") return null;
  try {
    const payload = JSON.parse(data) as { usage?: unknown; choices?: Array<{ delta?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.delta?.content;
    return {
      usage: parseUsage(payload.usage),
      contentLength: typeof content === "string" ? content.length : 0,
    };
  } catch {
    return null;
  }
}

function parseUsage(value: unknown): ProxyUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const prompt = numberOrUndefined(usage.prompt_tokens);
  const completion = numberOrUndefined(usage.completion_tokens);
  const total = numberOrUndefined(usage.total_tokens);
  if (prompt === undefined && completion === undefined && total === undefined) return undefined;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function estimateTokens(value: unknown): number {
  if (typeof value === "number") return Math.max(0, Math.ceil(value / 4));
  if (value === null || value === undefined) return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

function cost(model: string, requestTokens: number | null, responseTokens: number | null): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
  return ((requestTokens ?? 0) * pricing.inputPerMillionUsd
    + (responseTokens ?? 0) * pricing.outputPerMillionUsd) / 1_000_000;
}

async function emitInference(
  options: ProxyOptions,
  identity: AppTokenClaims,
  details: RequestDetails,
  values: {
    model: string;
    requestTokens: number | null;
    responseTokens: number | null;
    latencyMs: number;
    estimatedCostUsd: number;
    outcome: "success" | "error";
    requestId: string | null;
  },
): Promise<void> {
  await options.telemetry.append({
    id: options.createEventId?.() ?? crypto.randomUUID(),
    timestamp: new Date((options.now ?? Date.now)()).toISOString(),
    orgId: identity.org,
    appId: identity.sub,
    sessionId: details.sessionId,
    parentId: details.parentId,
    traceId: details.traceId ?? details.requestId,
    channel: "proxy",
    pluginId: "proxy:demo-openai-compatible",
    type: "inference",
    operation: "chat.completions",
    model: values.model,
    requestTokens: values.requestTokens,
    responseTokens: values.responseTokens,
    latencyMs: values.latencyMs,
    estimatedCostUsd: values.estimatedCostUsd,
    outcome: values.outcome,
  });
}

function isStreaming(response: Response): boolean {
  return response.headers.get("content-type")?.toLowerCase().includes("text/event-stream") ?? false;
}

function elapsed(options: ProxyOptions, startedAt: number): number {
  return Math.max(0, (options.now ?? Date.now)() - startedAt);
}

function emptyIdentity(): AppTokenClaims {
  return { sub: "", org: "", scopes: [], exp: 0 };
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
