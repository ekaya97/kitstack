export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Server-side proxy for the /demo operator dashboard. The browser never sees
 * the demo admin token: only signed-in KitStack admins reach the voice
 * service, and this route adds the token on their behalf.
 */
const ALLOWED = [
  /^api\/demo\/observability$/,
  /^api\/demo\/reset$/,
  /^t\/voice\/live\/start$/,
  /^t\/voice\/local\/start$/,
  /^v1\/apps\/register$/,
  /^v1\/apps\/[^/]+\/token$/,
];

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const path = (await params).path.map(encodeURIComponent).join("/");
  if (!ALLOWED.some((pattern) => pattern.test(path))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const base = (process.env.DEMO_API_URL || process.env.NEXT_PUBLIC_DEMO_API_URL || "").replace(/\/$/, "");
  if (!base) return NextResponse.json({ error: "demo_api_not_configured" }, { status: 503 });

  const headers: Record<string, string> = { "x-demo-admin-token": Resource.DemoAdminToken.value };
  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  const resetToken = request.headers.get("x-demo-reset-token");
  if (resetToken) headers["x-demo-reset-token"] = resetToken;

  const upstream = await fetch(`${base}/${path}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.text(),
    signal: AbortSignal.timeout(30_000),
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = forward;
export const POST = forward;
