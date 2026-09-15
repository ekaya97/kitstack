import type { AppRegistry, AppTokenClaims } from "./index.js";
import { bearerToken } from "./index.js";

/** Authentication modes supported by the unreleased demo MCP boundary. */
export type McpAuthMode = "none" | "app-token";

export interface McpAuthNoneContext {
  mode: "none";
  authenticated: false;
  appId: null;
  org: null;
  scopes: readonly [];
}

export interface McpAppTokenContext {
  mode: "app-token";
  authenticated: true;
  appId: string;
  org: string;
  scopes: readonly string[];
  claims: AppTokenClaims;
}

export type McpAuthContext = McpAuthNoneContext | McpAppTokenContext;

export interface McpAuthOptions {
  /** Must be selected explicitly; there is no implicit unauthenticated fallback. */
  mode: McpAuthMode;
  /** Required when `mode` is `app-token`. */
  registry?: AppRegistry;
  /** Optional scopes required by the MCP endpoint. */
  requiredScopes?: readonly string[];
}

export type McpAuthErrorCode =
  | "misconfigured"
  | "missing_bearer"
  | "invalid_token"
  | "insufficient_scope";

/** A typed authentication failure for the HTTP/MCP adapter to map to a response. */
export class McpAuthError extends Error {
  constructor(
    public readonly code: McpAuthErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "McpAuthError";
  }
}

/**
 * Authenticate one MCP request using an explicitly selected demo mode.
 *
 * `none` is intentionally an explicit mode for loopback-only demos. The helper
 * does not silently fall back to it when app-token verification is misconfigured
 * or a bearer token is missing.
 */
export async function authenticateMcpRequest(
  request: Request,
  options: McpAuthOptions,
): Promise<McpAuthContext> {
  if (options.mode === "none") {
    return {
      mode: "none",
      authenticated: false,
      appId: null,
      org: null,
      scopes: [],
    };
  }

  if (options.mode !== "app-token" || !options.registry) {
    throw new McpAuthError(
      "misconfigured",
      "MCP app-token authentication requires an app registry",
    );
  }

  const token = bearerToken(request);
  if (!token) {
    throw new McpAuthError("missing_bearer", "MCP Bearer token required");
  }

  let claims: AppTokenClaims;
  try {
    claims = await options.registry.verify(token);
  } catch (error) {
    throw new McpAuthError("invalid_token", "Invalid or expired MCP app token", { cause: error });
  }

  const requiredScopes = [...new Set(options.requiredScopes ?? [])]
    .map((scope) => scope.trim())
    .filter(Boolean);
  const missingScopes = requiredScopes.filter((scope) => !claims.scopes.includes(scope));
  if (missingScopes.length > 0) {
    throw new McpAuthError(
      "insufficient_scope",
      `MCP app token is missing required scope(s): ${missingScopes.join(", ")}`,
    );
  }

  return {
    mode: "app-token",
    authenticated: true,
    appId: claims.sub,
    org: claims.org,
    scopes: [...claims.scopes],
    claims: {
      ...claims,
      scopes: [...claims.scopes],
    },
  };
}
