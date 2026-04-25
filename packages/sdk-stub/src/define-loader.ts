import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitContext } from "./types";

export function defineLoader<T>(
  fn: (db: LibSQLDatabase, ctx: KitContext) => Promise<T>
): typeof fn {
  return fn;
}
