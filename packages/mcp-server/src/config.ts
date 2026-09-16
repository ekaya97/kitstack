/// <reference path="../../../.sst/platform/config.d.ts" />
/**
 * Centralized configuration for the MCP server.
 *
 * All SST Resource lookups are in one place. If you need to run the server
 * outside SST (e.g. self-hosted), swap the implementations to read from
 * process.env instead.
 */
import { Resource } from "sst";

// --- Database ---

export const tursoDbUrl = () => Resource.TursoDbUrl.value;
export const tursoAuthToken = () => Resource.TursoAuthToken.value;

// --- DynamoDB Tables ---

export const userKitDbsTable = () => Resource.UserKitDbs.name;
export const mcpAuthStoreTable = () => (Resource as any).MCPAuthStore.name;

// --- Auth & Security ---

export const mcpJwtSecret = () => {
  const secret = Resource.McpJwtSecret.value;
  if (!secret) throw new Error("MCP_JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
};
export const mcpAllowedOrigins = (): string[] =>
  (Resource.McpAllowedOrigins.value || "https://kitstack.co,https://www.kitstack.co")
    .split(",")
    .map((o: string) => o.trim());
export const mcpInternalApiKey = () => Resource.McpInternalApiKey.value;
export const betterAuthUrl = () => Resource.BetterAuthUrl.value || "http://localhost:3000";

// --- Demo voice bridge ---

/** Base URL for the private router → demo voice-service bridge. */
export const demoVoiceServiceUrl = (): string =>
  (process.env.KITSTACK_DEMO_VOICE_URL || (Resource as any).DemoVoice?.url || "").replace(/\/$/, "");

/** Secret shared only by the MCP router and the demo voice service. */
export const demoInternalSecret = (): Uint8Array => new TextEncoder().encode(
  (Resource as any).DemoInternalSecret?.value || process.env.KITSTACK_DEMO_INTERNAL_SECRET || "",
);

/** The unreleased demo has one synthetic organization. */
export const demoOrgId = (): string => process.env.KITSTACK_DEMO_ORG_ID?.trim() || "org-demo";

// --- Relay ---

export const devRelayUrl = (): string => (Resource as any).DevRelay?.url?.replace(/\/$/, "") || "";
export const devRelayStoreTable = (): string => (Resource as any).DevRelayStore?.name || "";

// --- Public URL ---

export const mcpPublicUrl = (): string => (Resource as any).McpDomain?.url?.replace(/\/$/, "") || "";

// --- CDN & Storage ---

export const kitCdnUrl = (): string => (Resource as any).KitCdn?.url?.replace(/\/$/, "") || "";
export const kitAssetsBucket = (): string => (Resource as any).KitAssets?.name || "";
export const appDataUrl = (): string => (Resource as any).AppData?.url?.replace(/\/$/, "") || "";

// --- Analytics ---

export const posthogKey = (): string | undefined => Resource.PosthogKey.value || undefined;
export const posthogHost = (): string => Resource.PosthogHost.value ?? "https://eu.i.posthog.com";
