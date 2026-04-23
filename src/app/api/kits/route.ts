import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllKits, getKitsByCategory } from "@/services/kit.service";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const kitsList = category
    ? await getKitsByCategory(db, category)
    : await getAllKits(db);

  return NextResponse.json({ kits: kitsList });
}
