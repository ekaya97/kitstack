/**
 * OAuth 2.0 server metadata returned by the `/.well-known/oauth-authorization-server`
 * endpoint. The shape follows RFC 8414 but only includes the fields the MCP
 * protocol requires for dynamic client registration and token exchange.
 *
 * @example
 * ```typescript
 * const meta: OAuthServerMetadata = {
 *   issuer: "https://my-kit.kitstack.app",
 *   authorization_endpoint: "https://my-kit.kitstack.app/oauth/authorize",
 *   token_endpoint: "https://my-kit.kitstack.app/oauth/token",
 *   response_types_supported: ["code"],
 *   grant_types_supported: ["authorization_code"],
 *   token_endpoint_auth_methods_supported: ["client_secret_post"],
 * };
 * ```
 */
export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

/**
 * Auth adapter interface for pluggable authentication in self-hosted kits.
 *
 * When a kit is deployed outside the KitStack relay (via `serve()`), an auth
 * adapter handles the full OAuth 2.0 lifecycle: metadata discovery, authorization,
 * token exchange, revocation, and token validation.
 *
 * The SDK ships two built-in adapters:
 * - `none()` — no-op adapter for local development and testing
 * - `kitstack()` (planned) — delegates to KitStack's identity provider
 *
 * Kit authors can implement this interface to integrate any OAuth provider
 * (e.g. Auth0, Clerk, or their own database-backed auth).
 *
 * @example
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import { none } from "@kitstack/sdk/server/auth";
 * import kit from "./kit.config";
 *
 * // Local dev — no real auth
 * serve(kit, { auth: none() });
 * ```
 *
 * @example
 * ```typescript
 * // Custom adapter skeleton
 * import type { AuthAdapter } from "@kitstack/sdk/server/auth";
 *
 * function myAuth(): AuthAdapter {
 *   return {
 *     metadata() { /* ... *\/ },
 *     async authorize(req) { /* ... *\/ },
 *     async token(req) { /* ... *\/ },
 *     async revoke(req) { /* ... *\/ },
 *     async validate(token) { /* ... *\/ },
 *   };
 * }
 * ```
 */
export interface AuthAdapter {
  /** Return OAuth 2.0 server metadata for the well-known endpoint. */
  metadata(): OAuthServerMetadata;

  /**
   * Handle an authorization request and return the redirect URL
   * (typically to a consent/login page).
   */
  authorize(req: Request): Promise<{ redirect: string }>;

  /**
   * Exchange an authorization code (or refresh token) for access credentials.
   */
  token(req: Request): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;

  /** Revoke a previously issued token. */
  revoke(req: Request): Promise<void>;

  /**
   * Validate a bearer token and return the associated user identity,
   * or `null` if the token is invalid/expired.
   */
  validate(token: string): Promise<{ userId: string } | null>;
}
