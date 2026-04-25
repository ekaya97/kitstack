import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitContext } from "./types";

/**
 * Define a server-side loader for a view. Loaders fetch typed data that
 * becomes the view component's props. They run on the server (Lambda or
 * dev process), not in the browser.
 *
 * Loaders typically call `tool.load()` to reuse the tool's data function,
 * so there's no separate queries layer. Types flow end-to-end from the
 * Drizzle `select()` in `load()` through the loader to the view component.
 *
 * @example
 * ```typescript
 * // views/contacts/loader.ts (CRM kit)
 * import { defineLoader } from "@kitstack/sdk";
 * import { listContacts } from "../../tools/list-contacts";
 *
 * export const loader = defineLoader(async (db, ctx) => {
 *   return listContacts.load(db, { limit: 100 }, ctx);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // views/dashboard/loader.ts — composing multiple tool loads
 * import { defineLoader } from "@kitstack/sdk";
 * import { pipelineDashboard } from "../../tools/pipeline-dashboard";
 * import { listContacts } from "../../tools/list-contacts";
 *
 * export const loader = defineLoader(async (db, ctx) => {
 *   const [dashboard, contacts] = await Promise.all([
 *     pipelineDashboard.load(db, {}, ctx),
 *     listContacts.load(db, { limit: 5 }, ctx),
 *   ]);
 *   return { dashboard, recentContacts: contacts };
 * });
 * ```
 */
export function defineLoader<T>(
  fn: (db: LibSQLDatabase, ctx: KitContext) => Promise<T>
): typeof fn {
  return fn;
}
