import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Resource } from "sst";
import { subscriptions } from "../web/src/db/schema";
import { nanoid } from "nanoid";

async function main() {
  const client = createClient({
    url: (Resource as any).TursoDbUrl.value,
    authToken: (Resource as any).TursoAuthToken.value,
  });
  const db = drizzle(client);

  const userId = "zMtInPsOn5JVTvJivmspvbptvCPSa6nP";
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await db
    .insert(subscriptions)
    .values({
      id: nanoid(),
      userId,
      plan: "pro",
      status: "active",
      currentPeriodEnd: oneYearFromNow,
    })
    .onConflictDoNothing();

  const rows = await db.select().from(subscriptions);
  console.log(`Subscriptions: ${rows.length}`, rows[0]?.plan, rows[0]?.status);
  process.exit(0);
}

main();
