import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Resource } from "sst";
import { authors } from "../web/src/db/schema";

async function main() {
  const client = createClient({
    url: (Resource as any).TursoDbUrl.value,
    authToken: (Resource as any).TursoAuthToken.value,
  });
  const db = drizzle(client);

  await db
    .insert(authors)
    .values({
      id: "author-kitstack",
      userId: null,
      handle: "kitstack",
      displayName: "KitStack",
      bio: "Official KitStack team. We build, test, and ship the foundational skills and kits.",
      avatarUrl: "/icon.svg",
      verified: true,
      website: "kitstack.co",
      location: "Düsseldorf, DE",
    })
    .onConflictDoNothing();

  const rows = await db.select().from(authors);
  console.log(`Seeded ${rows.length} author(s):`, rows[0]?.handle);
  process.exit(0);
}

main();
