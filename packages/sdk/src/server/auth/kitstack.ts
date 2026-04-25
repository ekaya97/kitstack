import type { AuthAdapter, OAuthServerMetadata } from "./adapter";

const DEFAULT_KITSTACK_URL = "https://kitstack.co";

/**
 * Configuration for the KitStack auth adapter.
 *
 * Register your kit at `https://kitstack.co/developer/apps` to get
 * a `clientId` and `clientSecret`. These are used for the standard
 * OAuth 2.0 authorization code flow between your self-hosted kit
 * and KitStack's identity provider.
 */
export interface KitStackAuthConfig {
  /** OAuth client ID from KitStack developer dashboard. */
  clientId: string;
  /** OAuth client secret from KitStack developer dashboard. */
  clientSecret: string;
  /**
   * Base URL for KitStack's auth endpoints.
   * @default "https://kitstack.co"
   */
  kitstackUrl?: string;
}

/**
 * Auth adapter that delegates identity to KitStack as an identity provider.
 *
 * Users sign in with their KitStack account ("Sign in with KitStack").
 * The adapter handles the OAuth 2.0 authorization code flow against
 * KitStack's endpoints. Your server never sees passwords — only
 * opaque access tokens that map to a `userId`.
 *
 * Register your kit at the KitStack developer dashboard to obtain
 * `clientId` and `clientSecret`.
 *
 * @param config - OAuth client credentials and optional base URL
 * @returns An {@link AuthAdapter} for use with `serve()`
 *
 * @example
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import { kitstack } from "@kitstack/sdk/server/auth";
 * import kit from "./kit.config";
 *
 * serve({
 *   kit,
 *   auth: kitstack({
 *     clientId: process.env.KITSTACK_CLIENT_ID!,
 *     clientSecret: process.env.KITSTACK_CLIENT_SECRET!,
 *   }),
 *   db: { url: process.env.DATABASE_URL! },
 *   transport: "http",
 *   port: 3000,
 * });
 * ```
 */
export function kitstack(config: KitStackAuthConfig): AuthAdapter {
  const baseUrl = (config.kitstackUrl ?? DEFAULT_KITSTACK_URL).replace(
    /\/$/,
    ""
  );

  return {
    metadata(): OAuthServerMetadata {
      return {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        revocation_endpoint: `${baseUrl}/oauth/revoke`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      };
    },

    async authorize(req: Request): Promise<{ redirect: string }> {
      const url = new URL(req.url);
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      });

      return {
        redirect: `${baseUrl}/oauth/authorize?${params.toString()}`,
      };
    },

    async token(req: Request): Promise<{
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
    }> {
      // Read the form body from the request
      const body = await req.text();
      const params = new URLSearchParams(body);

      // Add client credentials
      params.set("client_id", config.clientId);
      params.set("client_secret", config.clientSecret);

      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`KitStack token exchange failed: ${error}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 3600,
      };
    },

    async revoke(req: Request): Promise<void> {
      const body = await req.text();
      const params = new URLSearchParams(body);

      params.set("client_id", config.clientId);
      params.set("client_secret", config.clientSecret);

      await fetch(`${baseUrl}/oauth/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    },

    async validate(
      token: string
    ): Promise<{ userId: string } | null> {
      const response = await fetch(`${baseUrl}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.sub) return null;

      return { userId: data.sub };
    },
  };
}
