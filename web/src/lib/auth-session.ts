import { auth } from "./auth";
import { headers } from "next/headers";
import { log } from "./logger";

export async function getSessionOrNull() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireSession() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    log.warn("Session required but not found");
    throw new Error("Unauthorized");
  }
  return session;
}
