import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { Resource } from "sst";

const client = createClient({
  url: Resource.TursoDbUrl.value || process.env.TURSO_DATABASE_URL || "file:databases/local.db",
  authToken: Resource.TursoAuthToken.value || process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
