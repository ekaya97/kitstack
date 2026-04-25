/**
 * Auth adapter module for self-hosted kits.
 *
 * Re-exports the {@link AuthAdapter} interface and the built-in
 * {@link none} adapter. Import from `"@kitstack/sdk/server/auth"`.
 *
 * @example
 * ```typescript
 * import type { AuthAdapter } from "@kitstack/sdk/server/auth";
 * import { none } from "@kitstack/sdk/server/auth";
 * ```
 *
 * @module
 */
export type { AuthAdapter, OAuthServerMetadata } from "./adapter";
export { none } from "./none";
export { kitstack } from "./kitstack";
export type { KitStackAuthConfig } from "./kitstack";
