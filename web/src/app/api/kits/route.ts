export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAllKitCards } from "@/services/kit.service";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  let kits = await getAllKitCards();

  if (category && category !== "All") {
    kits = kits.filter((k) => k.cat === category);
  }

  return NextResponse.json({ kits });
}
