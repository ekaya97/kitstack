import { NextResponse } from "next/server";
import { authorize } from "../../../packages/authz/src/middleware";
import type { AuthzRequirement } from "../../../packages/authz/src/types";
import { getSessionOrNull } from "./auth-session";
import { db } from "./db";

type AuthzSuccess = { ok: true; userId: string; userName: string };
type AuthzFailure = { ok: false; response: NextResponse };
type AuthzResult = AuthzSuccess | AuthzFailure;

function deny(message: string, status: number): AuthzFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  };
}

/**
 * Authenticate the current request and check authorization requirements.
 *
 * - If requirements is empty, only authentication is enforced.
 * - Each requirement is a tuple check against the authz store.
 *
 * Returns { ok: true, userId } on success, or { ok: false, response } with
 * a ready-to-return NextResponse (401 or 403).
 */
export async function requireAuthorized(
  requirements: AuthzRequirement[] = []
): Promise<AuthzResult> {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return deny("Unauthorized", 401);
  }

  if (requirements.length > 0) {
    const result = await authorize(db, { userId: session.user.id }, requirements);
    if (!result.allowed) {
      return deny(result.reason ?? "Forbidden", 403);
    }
  }

  return { ok: true, userId: session.user.id, userName: session.user.name ?? "" };
}

export type { AuthzRequirement };
