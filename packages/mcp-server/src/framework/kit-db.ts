import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

export function createKitDbClient(dbUrl: string, dbToken: string) {
  const client = createClient({
    url: dbUrl,
    authToken: dbToken,
  });
  return drizzle(client);
}
