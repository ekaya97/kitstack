import type { AuthAdapter, OAuthServerMetadata } from "./adapter";

/**
 * Configuration for the custom OAuth auth adapter.
 *
 * Provide your own `authorize` and `validateToken` functions — the adapter
 * handles the MCP OAuth protocol plumbing (metadata endpoint, token endpoint
 * format, JSON-RPC auth errors).
 */
export interface OAuthConfig {
  /**
   * Issuer identifier for OAuth metadata. Typically your server's public URL.
   *
   * @example `"https://my-kit.example.com"`
   */
  issuer: string;

  /**
   * Handle an authorization request. Return a redirect URL to your login page.
   * The request includes standard OAuth query parameters (`redirect_uri`,
   * `state`, `code_challenge`, etc.).
   *
   * @example
   * ```typescript
   * authorize: async (req) => {
   *   const url = new URL(req.url);
   *   const redirectUri = url.searchParams.get("redirect_uri");
   *   const state = url.searchParams.get("state");
   *   return {
   *     redirect: `https://auth.example.com/login?redirect_uri=${redirectUri}&state=${state}`,
   *   };
   * }
   * ```
   */
  authorize: (req: Request) => Promise<{ redirect: string }>;

  /**
   * Exchange an authorization code for an access token. Called when
   * the MCP client hits the token endpoint with `grant_type=authorization_code`.
   *
   * Return the access token, optional refresh token, and expiry. If omitted,
   * the adapter returns a stub token — only useful when `validateToken` is
   * the primary auth mechanism (e.g. pre-shared API keys).
   */
  exchangeCode?: (code: string) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;

  /**
   * Validate a bearer token and return the associated user identity.
   * Return `null` if the token is invalid or expired.
   *
   * @example
   * ```typescript
   * validateToken: async (token) => {
   *   const user = await db.query.users.findFirst({
   *     where: eq(users.apiKey, token),
   *   });
   *   return user ? { userId: user.id } : null;
   * }
   * ```
   */
  validateToken: (token: string) => Promise<{ userId: string } | null>;

  /**
   * Revoke a token. Called when the MCP client hits the revocation endpoint.
   * If omitted, revocation is a no-op.
   */
  revokeToken?: (token: string) => Promise<void>;
}

/**
 * Custom OAuth auth adapter for fully self-hosted kits.
 *
 * Provides the MCP-required OAuth protocol plumbing while letting you
 * bring your own login flow and user store. No KitStack dependency.
 *
 * At minimum, provide `issuer`, `authorize`, and `validateToken`.
 * The adapter generates correct OAuth metadata, handles token exchange
 * (if `exchangeCode` is provided), and validates bearer tokens on
 * every MCP request.
 *
 * @param config - OAuth configuration with your custom handlers
 * @returns An {@link AuthAdapter} for use with `serve()`
 *
 * @example
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import { oauth } from "@kitstack/sdk/server/auth";
 * import kit from "./kit.config";
 *
 * serve({
 *   kit,
 *   auth: oauth({
 *     issuer: "https://my-kit.example.com",
 *     authorize: async (req) => {
 *       const url = new URL(req.url);
 *       return { redirect: `https://auth.example.com/login?state=${url.searchParams.get("state")}` };
 *     },
 *     validateToken: async (token) => {
 *       const user = await myUserDb.findByToken(token);
 *       return user ? { userId: user.id } : null;
 *     },
 *   }),
 *   db: { url: process.env.DATABASE_URL! },
 *   transport: "http",
 *   port: 3000,
 * });
 * ```
 */
export function oauth(config: OAuthConfig): AuthAdapter {
  const issuer = config.issuer.replace(/\/$/, "");

  return {
    metadata(): OAuthServerMetadata {
      return {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        revocation_endpoint: `${issuer}/oauth/revoke`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      };
    },

    async authorize(req: Request): Promise<{ redirect: string }> {
      return config.authorize(req);
    },

    async token(req: Request): Promise<{
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
    }> {
      if (!config.exchangeCode) {
        return {
          accessToken: "no-exchange-configured",
          expiresIn: 3600,
        };
      }

      const body = await req.text();
      const params = new URLSearchParams(body);
      const code = params.get("code") ?? "";

      return config.exchangeCode(code);
    },

    async revoke(req: Request): Promise<void> {
      if (!config.revokeToken) return;

      const body = await req.text();
      const params = new URLSearchParams(body);
      const token = params.get("token") ?? "";

      await config.revokeToken(token);
    },

    async validate(
      token: string
    ): Promise<{ userId: string } | null> {
      return config.validateToken(token);
    },
  };
}
