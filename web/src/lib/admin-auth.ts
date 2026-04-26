import { auth } from "./auth";
import { headers } from "next/headers";
import { db } from "./db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (row?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return session;
}
