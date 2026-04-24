// ── Database ────────────────────────────────────────────────────
export const tursoDbUrl = new sst.Secret("TursoDbUrl", "http://127.0.0.1:8080");
export const tursoAuthToken = new sst.Secret("TursoAuthToken", "");
export const tursoPlatformApiToken = new sst.Secret("TursoPlatformApiToken", "");
export const tursoOrgName = new sst.Secret("TursoOrgName", "");

// ── Auth ────────────────────────────────────────────────────────
export const betterAuthSecret = new sst.Secret("BetterAuthSecret", "");
export const betterAuthUrl = new sst.Secret("BetterAuthUrl", "http://localhost:3000");
export const googleClientId = new sst.Secret("GoogleClientId", "");
export const googleClientSecret = new sst.Secret("GoogleClientSecret", "");
export const githubClientId = new sst.Secret("GithubClientId", "");
export const githubClientSecret = new sst.Secret("GithubClientSecret", "");

// ── MCP ─────────────────────────────────────────────────────────
export const mcpJwtSecret = new sst.Secret("McpJwtSecret", "");
export const mcpAllowedOrigins = new sst.Secret("McpAllowedOrigins", "http://localhost:3000");
export const mcpInternalApiKey = new sst.Secret("McpInternalApiKey", "");

// ── Billing ─────────────────────────────────────────────────────
export const lemonsqueezyApiKey = new sst.Secret("LemonsqueezyApiKey", "");
export const lemonsqueezyStoreId = new sst.Secret("LemonsqueezyStoreId", "");
export const lemonsqueezyWebhookSecret = new sst.Secret("LemonsqueezyWebhookSecret", "");

// ── Analytics ───────────────────────────────────────────────────
export const posthogKey = new sst.Secret("PosthogKey", "");
export const posthogHost = new sst.Secret("PosthogHost", "https://eu.i.posthog.com");

