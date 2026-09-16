import type { TelemetryEventInput, TelemetryStore } from "../../telemetry/index.js";

export const SIMULATOR_PROVIDER = "simulator" as const;
export const REALTIME_PROVIDER = "realtime" as const;
export type VoiceProvider = typeof SIMULATOR_PROVIDER | typeof REALTIME_PROVIDER;

export const DEFAULT_SIMULATOR_MODEL = "simulator-german-sales-v1";
export const DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview";
export const DEFAULT_PROVIDER_CONFIG: Readonly<VoiceProviderConfig> = {
  provider: SIMULATOR_PROVIDER,
  model: DEFAULT_SIMULATOR_MODEL,
  recording: false,
  retention: false,
};

export interface RealtimeProviderConfig {
  twilioMediaStreamsUrl: string;
  openaiRealtimeUrl: string;
  model?: string;
}

export interface VoiceProviderConfig {
  /** The simulator is the safe, deterministic default for the demo. */
  provider?: VoiceProvider;
  model?: string;
  realtime?: RealtimeProviderConfig;
  /** Provider-side recording is disabled for every demo call. */
  recording?: false;
  /** Provider-side retention is disabled for every demo call. */
  retention?: false;
}

export interface ResolvedVoiceProviderConfig {
  provider: VoiceProvider;
  model: string;
  recording: false;
  retention: false;
  realtime?: RealtimeProviderConfig;
}

export type ProviderCallStatus = "ready" | "connecting" | "failed";

export interface ProviderMediaBoundary {
  transport: "twilio-media-streams";
  direction: "bidirectional";
  audioFormat: "provider-defined";
  recording: false;
  retention: false;
}

export interface ProviderCallBoundary {
  callId: string;
  sessionId: string;
  provider: VoiceProvider;
  model: string;
  status: ProviderCallStatus;
  recording: false;
  retention: false;
  media: ProviderMediaBoundary;
}

export interface StartProviderCallOptions {
  sessionId: string;
  orgId: string;
  appId: string | null;
  telemetry: Pick<TelemetryStore, "append">;
  config?: VoiceProviderConfig;
  now?: () => string;
  createId?: () => string;
}

/**
 * Resolve provider selection without contacting a provider. Realtime is an
 * explicit opt-in; incomplete realtime configuration is rejected at the
 * boundary before a caller can mistake the demo for a live call.
 */
export function resolveVoiceProviderConfig(config: VoiceProviderConfig = {}): ResolvedVoiceProviderConfig {
  const provider = config.provider ?? DEFAULT_PROVIDER_CONFIG.provider;
  const recording = config.recording ?? false;
  const retention = config.retention ?? false;

  if (recording || retention) {
    throw new Error("Demo voice provider recording and retention must remain disabled");
  }

  if (provider === REALTIME_PROVIDER) {
    const realtime = config.realtime;
    if (!realtime?.twilioMediaStreamsUrl || !realtime.openaiRealtimeUrl) {
      throw new Error("Realtime provider requires Twilio Media Streams and OpenAI Realtime URLs");
    }
    return {
      provider,
      model: config.model ?? realtime.model ?? DEFAULT_REALTIME_MODEL,
      recording: false,
      retention: false,
      realtime,
    };
  }

  return {
    provider: SIMULATOR_PROVIDER,
    model: config.model ?? DEFAULT_SIMULATOR_MODEL,
    recording: false,
    retention: false,
  };
}

/**
 * Creates only the provider boundary used by the demo. It deliberately does
 * not open a Twilio/OpenAI connection; live credentials and network behavior
 * belong behind this seam.
 */
export async function startProviderCall(options: StartProviderCallOptions): Promise<ProviderCallBoundary> {
  const config = resolveVoiceProviderConfig(options.config);
  const createId = options.createId ?? (() => crypto.randomUUID());
  const callId = createId();
  const event: TelemetryEventInput = {
    id: createId(),
    timestamp: (options.now ?? (() => new Date().toISOString()))(),
    orgId: options.orgId,
    appId: options.appId,
    sessionId: options.sessionId,
    traceId: options.sessionId,
    channel: "voice",
    kitId: "kit:debrief",
    type: "voice.call",
    operation: "start:recording-off:retention-off",
    model: config.model,
    outcome: "started",
  };
  await options.telemetry.append(event);

  return {
    callId,
    sessionId: options.sessionId,
    provider: config.provider,
    model: config.model,
    status: "ready",
    recording: false,
    retention: false,
    media: {
      transport: "twilio-media-streams",
      direction: "bidirectional",
      audioFormat: "provider-defined",
      recording: false,
      retention: false,
    },
  };
}

export interface ExternalSmokeOptions {
  publicHttpsUrl?: string;
  publicWssUrl?: string;
  claudeMcpUrl?: string;
  fetch?: (input: string, init?: { method?: string }) => Promise<{ ok: boolean; status: number }>;
}

export interface ExternalSmokeResult {
  status: "green" | "blocked" | "failed";
  live: false;
  publicHttps: SmokeCheck;
  publicWss: SmokeCheck;
  claudeMcp: SmokeCheck;
}

export interface SmokeCheck {
  status: "pass" | "blocked" | "fail";
  detail: string;
}

/**
 * Validate the external demo gate with injected I/O. Missing env/config is a
 * blocked result, never a green result; this helper cannot claim live voice.
 */
export async function runExternalSmoke(options: ExternalSmokeOptions = {}): Promise<ExternalSmokeResult> {
  const fetcher = options.fetch;
  const publicHttps = await checkHttpEndpoint(options.publicHttpsUrl, "https:", fetcher, "public HTTPS");
  const publicWss = await checkHttpEndpoint(options.publicWssUrl, "wss:", fetcher, "public WSS");
  const claudeMcp = await checkHttpEndpoint(options.claudeMcpUrl, "https:", fetcher, "Claude MCP /mcp");
  const checks = [publicHttps, publicWss, claudeMcp];
  const status = checks.some((check) => check.status === "fail") ? "failed" : checks.some((check) => check.status === "blocked") ? "blocked" : "green";
  return { status, live: false, publicHttps, publicWss, claudeMcp };
}

function checkUrl(value: string | undefined, protocol: string, label: string): SmokeCheck {
  if (!value) return { status: "blocked", detail: `${label} URL is not configured` };
  try {
    const url = new URL(value);
    if (url.protocol !== protocol || !url.hostname) return { status: "fail", detail: `${label} must use ${protocol}//` };
    return { status: "pass", detail: `${label} has a public ${protocol} endpoint` };
  } catch {
    return { status: "fail", detail: `${label} URL is invalid` };
  }
}

async function checkHttpEndpoint(value: string | undefined, protocol: string, fetcher: ExternalSmokeOptions["fetch"], label: string): Promise<SmokeCheck> {
  const urlCheck = checkUrl(value, protocol, label);
  if (urlCheck.status !== "pass") return urlCheck;
  if (!fetcher) return { status: "blocked", detail: `${label} fetcher is not injected` };
  try {
    const response = await fetcher(value!, { method: "GET" });
    return response.ok ? { status: "pass", detail: `${label} responded with HTTP ${response.status}` } : { status: "fail", detail: `${label} responded with HTTP ${response.status}` };
  } catch (error) {
    return { status: "fail", detail: `${label} request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
