export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getKitBySlug } from "@/services/kit.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const kit = await getKitBySlug(slug);

  if (!kit) {
    return NextResponse.json({ error: "Kit not found" }, { status: 404 });
  }

  return NextResponse.json(kit);
}
