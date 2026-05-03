export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSkillBySlug } from "@/services/skill.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json(skill);
}
