import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kits } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allKits = await db.select().from(kits).orderBy(kits.name);
  return NextResponse.json({ kits: allKits });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const {
    slug,
    name,
    category,
    description,
    correspondingSkillSlug,
    replaces,
    savingsPerMonth,
    dbSchema,
    mcpTools,
    mcpApps,
    tagline,
    author,
    status,
  } = body;

  if (!slug || !name || !category || !description || !replaces || savingsPerMonth == null) {
    return NextResponse.json(
      { error: "Missing required fields: slug, name, category, description, replaces, savingsPerMonth" },
      { status: 400 },
    );
  }

  const id = `kit-${slug}`;
  const now = new Date();

  await db
    .insert(kits)
    .values({
      id,
      slug,
      name,
      category: category as any,
      description,
      correspondingSkillSlug: correspondingSkillSlug || null,
      replaces,
      savingsPerMonth: Number(savingsPerMonth),
      dbSchema: dbSchema || null,
      mcpTools: mcpTools ? JSON.parse(mcpTools) : null,
      mcpApps: mcpApps ? JSON.parse(mcpApps) : null,
      tagline: tagline || null,
      author: author || "kitstack",
      status: (status as any) || "live",
      subscriberCount: 0,
      avgRating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: kits.slug,
      set: {
        name,
        category: category as any,
        description,
        correspondingSkillSlug: correspondingSkillSlug || null,
        replaces,
        savingsPerMonth: Number(savingsPerMonth),
        dbSchema: dbSchema || null,
        mcpTools: mcpTools ? JSON.parse(mcpTools) : null,
        mcpApps: mcpApps ? JSON.parse(mcpApps) : null,
        tagline: tagline || null,
        author: author || "kitstack",
        status: (status as any) || "live",
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true, slug });
}
