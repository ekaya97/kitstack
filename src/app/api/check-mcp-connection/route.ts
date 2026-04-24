import { NextResponse } from "next/server";
import { resource } from "@/lib/resource";
import { getSessionOrNull } from "@/lib/auth-session";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ connected: false, reason: "not_logged_in" });
  }

  try {
    const mcpUrl = resource("McpRouter").url.replace(/\/$/, "");
    const res = await fetch(
      `${mcpUrl}/connected?userId=${encodeURIComponent(session.user.id)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ connected: false, reason: "server_error", status: res.status, body });
    }

    const data = await res.json();
    return NextResponse.json({ connected: data.connected });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      reason: "server_unreachable",
      debug: err.message,
    });
  }
}
