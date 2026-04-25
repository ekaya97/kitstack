import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { Resource } from "sst";

const client = createClient({
  url: Resource.TursoDbUrl.value,
  authToken: Resource.TursoAuthToken.value,
});

export const db = drizzle(client, { schema });
