import type { AuthAdapter, OAuthServerMetadata } from "./adapter";

const DEFAULT_USER_ID = "local-dev-user";

/**
 * No-op auth adapter for local development and testing.
 *
 * Every call to `validate()` succeeds and returns a fixed user ID
 * (`"local-dev-user"` by default). The OAuth endpoints return
 * placeholder values — real authorization never takes place.
 *
 * Use this when running `kitstack dev --stdio` or in integration tests
 * where authentication is irrelevant.
 *
 * @param options - Optional overrides.
 * @param options.userId - User ID returned by `validate()`. Defaults to `"local-dev-user"`.
 *
 * @example
 * ```typescript
 * import { serve } from "@kitstack/sdk/server";
 * import { none } from "@kitstack/sdk/server/auth";
 * import kit from "./kit.config";
 *
 * serve(kit, { auth: none() });
 * ```
 *
 * @example
 * ```typescript
 * // Pin a specific user ID for deterministic test assertions
 * import { none } from "@kitstack/sdk/server/auth";
 *
 * const adapter = none({ userId: "test-user-42" });
 * const result = await adapter.validate("any-token");
 * // result === { userId: "test-user-42" }
 * ```
 */
export function none(options?: { userId?: string }): AuthAdapter {
  const userId = options?.userId ?? DEFAULT_USER_ID;

  return {
    metadata(): OAuthServerMetadata {
      return {
        issuer: "http://localhost",
        authorization_endpoint: "http://localhost/oauth/authorize",
        token_endpoint: "http://localhost/oauth/token",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        token_endpoint_auth_methods_supported: ["none"],
      };
    },

    async authorize() {
      return { redirect: "/" };
    },

    async token() {
      return {
        accessToken: "dev-token",
        expiresIn: 86400,
      };
    },

    async revoke() {},

    async validate() {
      return { userId };
    },
  };
}
