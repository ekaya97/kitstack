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

export const mcpJwtSecret = () => new TextEncoder().encode(Resource.McpJwtSecret.value);
export const mcpAllowedOrigins = (): string[] =>
  (Resource.McpAllowedOrigins.value || "https://kitstack.co,https://www.kitstack.co")
    .split(",")
    .map((o: string) => o.trim());
export const mcpInternalApiKey = () => Resource.McpInternalApiKey.value;
export const betterAuthUrl = () => Resource.BetterAuthUrl.value || "http://localhost:3000";

// --- Relay ---

export const devRelayUrl = (): string => (Resource as any).DevRelay?.url?.replace(/\/$/, "") || "";
export const devRelayStoreTable = (): string => (Resource as any).DevRelayStore?.name || "";

// --- CDN & Storage ---

export const kitCdnUrl = (): string => (Resource as any).KitCdn?.url?.replace(/\/$/, "") || "";
export const kitAssetsBucket = (): string => (Resource as any).KitAssets?.name || "";
export const appDataUrl = (): string => (Resource as any).AppData?.url?.replace(/\/$/, "") || "";

// --- Analytics ---

export const posthogKey = (): string | undefined => Resource.PosthogKey.value || undefined;
export const posthogHost = (): string => Resource.PosthogHost.value ?? "https://eu.i.posthog.com";
