import crypto from "node:crypto";
import { generateAuthCode } from "./helpers";
import type { OAuthStoreItem } from "../types";

export interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state?: string;
}

/**
 * Step 1: Validate authorize request parameters.
 * Also validates redirect_uri against the registered client's allowed URIs.
 */
export async function validateAuthorizeRequest(
  params: AuthorizeParams,
  getOAuthItem: (pk: string, sk: string) => Promise<OAuthStoreItem | null>
): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (params.response_type !== "code") {
    return { valid: false, error: "unsupported_response_type" };
  }
  if (!params.client_id) {
    return { valid: false, error: "invalid_request: missing client_id" };
  }
  if (!params.redirect_uri) {
    return { valid: false, error: "invalid_request: missing redirect_uri" };
  }
  if (!params.code_challenge) {
    return { valid: false, error: "invalid_request: missing code_challenge" };
  }

  // Validate redirect_uri against registered client
  const client = await getOAuthItem(`CLIENT#${params.client_id}`, "REGISTRATION");
  if (!client) {
    return { valid: false, error: "invalid_client: client_id not registered" };
  }
  const registration = JSON.parse(client.data);
  if (!registration.redirect_uris?.includes(params.redirect_uri)) {
    return { valid: false, error: "invalid_request: redirect_uri not registered for this client" };
  }

  return { valid: true };
}

/**
 * Step 1b: Store authorize params server-side and return a session key.
 * This prevents params from being tampered with during the login redirect.
 */
export async function storeAuthorizeSession(
  params: AuthorizeParams,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>
): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("base64url");

  await putOAuthItem({
    pk: `AUTHSESSION#${sessionId}`,
    sk: "PARAMS",
    data: JSON.stringify(params),
    ttl: Math.floor(Date.now() / 1000) + 10 * 60, // 10 min TTL
  });

  return sessionId;
}

/**
 * Step 2: After user authenticates, look up stored session and issue an authorization code.
 */
export async function issueAuthCode(
  userId: string,
  sessionId: string,
  getOAuthItem: (pk: string, sk: string) => Promise<OAuthStoreItem | null>,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>,
  deleteOAuthItem: (pk: string, sk: string) => Promise<void>
): Promise<{ code: string; redirectUri: string; state?: string }> {
  // Look up the stored authorize session
  const session = await getOAuthItem(`AUTHSESSION#${sessionId}`, "PARAMS");
  if (!session) {
    throw new Error("invalid_session: authorize session not found or expired");
  }

  const params = JSON.parse(session.data) as AuthorizeParams;

  // Delete the session (one-time use)
  await deleteOAuthItem(`AUTHSESSION#${sessionId}`, "PARAMS");

  const code = generateAuthCode();

  // Store the code with all the context needed for exchange (10 min TTL)
  await putOAuthItem({
    pk: `CODE#${code}`,
    sk: "AUTH",
    data: JSON.stringify({
      userId,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method || "S256",
    }),
    ttl: Math.floor(Date.now() / 1000) + 10 * 60,
  });

  return { code, redirectUri: params.redirect_uri, state: params.state };
}
