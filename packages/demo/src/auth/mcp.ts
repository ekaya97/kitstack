import type { AppRegistry, AppTokenClaims } from "./index.js";
import { bearerToken } from "./index.js";
import { jwtVerify, SignJWT } from "jose";

/** Authentication modes supported by the unreleased demo MCP boundary. */
export type McpAuthMode = "none" | "app-token" | "internal-signed";

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

export interface InternalSignedMcpClaims {
  sub: string;
  org: string;
  kit: "debrief";
  req: string;
  trace: string;
  exp: number;
}

export interface McpInternalSignedContext {
  mode: "internal-signed";
  authenticated: true;
  appId: null;
  org: string;
  scopes: readonly ["mcp"];
  claims: InternalSignedMcpClaims;
}

export type McpAuthContext = McpAuthNoneContext | McpAppTokenContext | McpInternalSignedContext;

export interface McpAuthOptions {
  /** Must be selected explicitly; there is no implicit unauthenticated fallback. */
  mode: McpAuthMode;
  /** Required when `mode` is `app-token`. */
  registry?: AppRegistry;
  /** Required when `mode` is `internal-signed`; defaults to the service env. */
  internalSecret?: Uint8Array | string;
  /** Trusted user → organization mapping for router-to-demo calls. */
  internalUserOrgAllowlist?: Readonly<Record<string, string>>;
  /** Injectable clock for deterministic auth tests. */
  now?: () => number;
  /** Optional scopes required by the MCP endpoint. */
  requiredScopes?: readonly string[];
}

export type McpAuthErrorCode =
  | "misconfigured"
  | "missing_bearer"
  | "invalid_token"
  | "insufficient_scope"
  | "forbidden_identity";

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

  if (options.mode === "internal-signed") {
    const token = bearerToken(request);
    if (!token) {
      throw new McpAuthError("missing_bearer", "MCP internal bearer token required");
    }

    const claims = await verifyInternalSignedMcpToken(token, {
      secret: options.internalSecret ?? process.env.KITSTACK_DEMO_INTERNAL_SECRET,
      now: options.now,
    });
    const allowlist = options.internalUserOrgAllowlist ?? readInternalUserOrgAllowlist();
    const expectedOrg = allowlist[claims.sub] ?? allowlist["*"];
    if (!expectedOrg || expectedOrg !== claims.org) {
      throw new McpAuthError(
        "forbidden_identity",
        "MCP internal identity is not allowlisted for this demo organization",
      );
    }

    return {
      mode: "internal-signed",
      authenticated: true,
      appId: null,
      org: claims.org,
      scopes: ["mcp"],
      claims,
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

export interface SignInternalMcpTokenInput {
  userId: string;
  org: string;
  req: string;
  trace: string;
  ttlSeconds?: number;
}

export interface InternalMcpTokenOptions {
  secret?: Uint8Array | string;
  now?: () => number;
}

/** Sign the short-lived router → demo-service identity token. */
export async function signInternalSignedMcpToken(
  input: SignInternalMcpTokenInput,
  options: InternalMcpTokenOptions = {},
): Promise<string> {
  const secret = internalSecret(options.secret);
  const now = options.now ?? Date.now;
  const ttlSeconds = input.ttlSeconds ?? 60;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
    throw new Error("Internal MCP token ttlSeconds must be between 1 and 300");
  }
  if (!input.userId.trim() || !input.org.trim() || !input.req.trim() || !input.trace.trim()) {
    throw new Error("Internal MCP token requires userId, org, req, and trace");
  }

  return new SignJWT({
    org: input.org,
    kit: "debrief",
    req: input.req,
    trace: input.trace,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setExpirationTime(Math.floor(now() / 1000) + ttlSeconds)
    .sign(secret);
}

export async function verifyInternalSignedMcpToken(
  token: string,
  options: InternalMcpTokenOptions = {},
): Promise<InternalSignedMcpClaims> {
  let payload;
  try {
    const result = await jwtVerify(token, internalSecret(options.secret), {
      algorithms: ["HS256"],
      currentDate: new Date((options.now ?? Date.now)()),
    });
    payload = result.payload;
  } catch (error) {
    throw new McpAuthError("invalid_token", "Invalid or expired MCP internal token", { cause: error });
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.org !== "string" ||
    payload.kit !== "debrief" ||
    typeof payload.req !== "string" ||
    typeof payload.trace !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new McpAuthError("invalid_token", "Invalid MCP internal token claims");
  }

  return {
    sub: payload.sub,
    org: payload.org,
    kit: "debrief",
    req: payload.req,
    trace: payload.trace,
    exp: payload.exp,
  };
}

function internalSecret(value: Uint8Array | string | undefined): Uint8Array {
  const secret = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value ?? new TextEncoder().encode(process.env.KITSTACK_DEMO_INTERNAL_SECRET ?? "");
  if (secret.byteLength < 32) {
    throw new McpAuthError("misconfigured", "MCP internal signing secret must be at least 32 bytes");
  }
  return secret;
}

function readInternalUserOrgAllowlist(): Readonly<Record<string, string>> {
  const raw = process.env.KITSTACK_DEMO_INTERNAL_USER_ORG_ALLOWLIST?.trim();
  if (!raw) return {};

  const result: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const [userId, orgId] = entry.split("=", 2).map((value) => value.trim());
    if (userId && orgId) result[userId] = orgId;
  }
  return result;
}
