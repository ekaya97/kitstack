import { generateAuthCode } from "./helpers";
import type { OAuthStoreItem } from "../../framework/types";

interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state?: string;
}

/**
 * Step 1: Validate authorize request and return a redirect URL to the login page.
 * After login, the callback will call issueAuthCode to generate the code.
 */
export function validateAuthorizeRequest(params: AuthorizeParams): {
  valid: boolean;
  error?: string;
} {
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
  return { valid: true };
}

/**
 * Step 2: After user authenticates, issue an authorization code.
 */
export async function issueAuthCode(
  userId: string,
  params: AuthorizeParams,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>
): Promise<string> {
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

  return code;
}
