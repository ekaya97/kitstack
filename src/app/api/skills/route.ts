import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllSkills, getSkillsByCategory } from "@/services/skill.service";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const skillsList = category
    ? await getSkillsByCategory(db, category)
    : await getAllSkills(db);

  return NextResponse.json({ skills: skillsList });
}
