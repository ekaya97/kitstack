/**
 * Auth adapter module for self-hosted kits.
 *
 * Re-exports the {@link AuthAdapter} interface and the three built-in
 * adapters: {@link none}, {@link kitstack}, and {@link oauth}.
 * Import from `"@kitstack/sdk/server/auth"`.
 *
 * - **{@link none}** — no-op adapter for local development and testing
 * - **{@link kitstack}** — delegates identity to KitStack's OAuth 2.0 provider
 * - **{@link oauth}** — bring your own OAuth provider (Auth0, Clerk, custom DB, etc.)
 *
 * @example
 * ```typescript
 * // Import the adapter you need
 * import { none, kitstack, oauth } from "@kitstack/sdk/server/auth";
 * import type { AuthAdapter } from "@kitstack/sdk/server/auth";
 *
 * // Dev: no auth
 * const dev = none();
 *
 * // Production: KitStack identity
 * const prod = kitstack({ clientId: "...", clientSecret: "..." });
 *
 * // Self-hosted: custom OAuth
 * const custom = oauth({
 *   issuer: "https://my-kit.example.com",
 *   authorize: async (req) => ({ redirect: "https://auth.example.com/login" }),
 *   validateToken: async (token) => ({ userId: "u_123" }),
 * });
 * ```
 *
 * @module
 */
export type { AuthAdapter, OAuthServerMetadata } from "./adapter";
export { none } from "./none";
export { kitstack } from "./kitstack";
export type { KitStackAuthConfig } from "./kitstack";
export { oauth } from "./oauth";
export type { OAuthConfig } from "./oauth";
