import { auth } from "./auth";
import { headers } from "next/headers";
import { db } from "./db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { log } from "./logger";

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Admin access denied: no session");
    throw new Error("Unauthorized");
  }

  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (row?.role !== "admin") {
    log.warn("Admin access denied", { userId: session.user.id, actualRole: row?.role });
    throw new Error("Forbidden");
  }

  return session;
}
