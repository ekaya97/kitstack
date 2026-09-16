import { vi } from "vitest";

/**
 * Provide deterministic SST link values for package tests.
 * Production handlers still resolve values through SST; tests should not
 * require an `sst dev` multiplexer just to import a pure router module.
 */
vi.mock("sst", () => {
  const value = (envName: string, fallback: string) => ({
    get value() {
      return process.env[envName] ?? fallback;
    },
  });

  return {
    Resource: {
      TursoDbUrl: value("TURSO_DB_URL", "file::memory:"),
      TursoAuthToken: value("TURSO_AUTH_TOKEN", ""),
      UserKitDbs: { name: "test-user-kit-dbs" },
      MCPAuthStore: { name: "test-mcp-auth-store" },
      McpJwtSecret: value("MCP_JWT_SECRET", "kitstack-test-secret-that-is-at-least-32-chars"),
      McpAllowedOrigins: value("MCP_ALLOWED_ORIGINS", "http://localhost:3000"),
      McpInternalApiKey: value("MCP_INTERNAL_API_KEY", "test-internal-key"),
      BetterAuthUrl: value("BETTER_AUTH_URL", "http://localhost:3000"),
      PosthogKey: value("POSTHOG_KEY", ""),
      PosthogHost: value("POSTHOG_HOST", "https://eu.i.posthog.com"),
    },
  };
});
