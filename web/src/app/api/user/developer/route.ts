import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kitActivations } from "@/db/schema";
import { kitRegistryTable, kitViewsTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-session";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get all kits this user is an author of from kit_registry
  // kit_registry has authorId which maps to userId
  const registryRows = await db
    .select()
    .from(kitRegistryTable)
    .where(eq(kitRegistryTable.authorId, userId));

  // Group by kitId
  const kitMap = new Map<
    string,
    {
      kitId: string;
      kitName: string;
      kitDescription: string | null;
      visibility: string;
      tools: { name: string; description: string }[];
    }
  >();

  for (const row of registryRows) {
    if (!kitMap.has(row.kitId)) {
      kitMap.set(row.kitId, {
        kitId: row.kitId,
        kitName: row.kitName,
        kitDescription: row.kitDescription,
        visibility: row.visibility,
        tools: [],
      });
    }
    kitMap.get(row.kitId)!.tools.push({
      name: row.toolName,
      description: row.toolDescription,
    });
  }

  const kitIds = [...kitMap.keys()];

  // Get views for these kits
  const views =
    kitIds.length > 0
      ? await db
          .select()
          .from(kitViewsTable)
          .where(
            sql`${kitViewsTable.kitId} IN (${sql.join(
              kitIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [];

  // Get activation counts per kit
  const activationCounts =
    kitIds.length > 0
      ? await db
          .select({
            kitSlug: kitActivations.kitSlug,
            count: sql<number>`count(*)`,
          })
          .from(kitActivations)
          .where(
            sql`${kitActivations.kitSlug} IN (${sql.join(
              kitIds.map((id) => sql`${id}`),
              sql`, `,
            )}) AND ${kitActivations.status} = 'active'`,
          )
          .groupBy(kitActivations.kitSlug)
      : [];

  const activationMap = new Map(activationCounts.map((a) => [a.kitSlug, a.count]));

  // Assemble response
  const kits = kitIds.map((kitId) => {
    const kit = kitMap.get(kitId)!;
    const kitViews = views.filter((v) => v.kitId === kitId);
    return {
      ...kit,
      views: kitViews.map((v) => ({
        slug: v.viewSlug,
        name: v.viewName,
        description: v.viewDescription,
      })),
      activeUsers: activationMap.get(kitId) || 0,
    };
  });

  return NextResponse.json({ kits });
}
