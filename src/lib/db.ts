import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { resource } from "./resource";

const client = createClient({
  url: resource("TursoDbUrl")?.value || process.env.TURSO_DATABASE_URL || "file:databases/local.db",
  authToken: resource("TursoAuthToken")?.value || process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
