import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { Resource } from "sst";

let _db: LibSQLDatabase<typeof schema> | null = null;

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_, prop) {
    if (!_db) {
      const client = createClient({
        url: Resource.TursoDbUrl.value,
        authToken: Resource.TursoAuthToken.value,
      });
      _db = drizzle(client, { schema });
    }
    return (_db as any)[prop];
  },
});
