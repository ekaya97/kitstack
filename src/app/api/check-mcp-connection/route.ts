import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-session";

const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || "https://mcp.kitstack.co";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ connected: false, reason: "not_logged_in" });
  }

  try {
    // Ask the MCP router if this user has completed the OAuth flow
    // The /connected endpoint checks OAuthStore for active refresh tokens
    const res = await fetch(
      `${MCP_SERVER_URL}/connected?userId=${encodeURIComponent(session.user.id)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      return NextResponse.json({ connected: false, reason: "server_error" });
    }

    const data = await res.json();
    return NextResponse.json({ connected: data.connected });
  } catch {
    return NextResponse.json({ connected: false, reason: "server_unreachable" });
  }
}
