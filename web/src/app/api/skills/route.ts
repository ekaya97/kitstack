import { NextRequest, NextResponse } from "next/server";
import { getAllSkillCards } from "@/services/skill.service";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const search = request.nextUrl.searchParams.get("search");

  let skills = await getAllSkillCards();

  if (category && category !== "All") {
    skills = skills.filter((s) => s.cat === category);
  }

  if (search) {
    const q = search.toLowerCase();
    skills = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.cat.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ skills });
}
