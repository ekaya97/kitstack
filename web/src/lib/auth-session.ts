import { auth } from "./auth";
import { headers } from "next/headers";

export async function getSessionOrNull() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireSession() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}
