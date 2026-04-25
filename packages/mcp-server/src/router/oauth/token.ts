import {
  verifyCodeChallenge,
  signAccessToken,
  generateRefreshToken,
} from "./helpers";
import type { OAuthStoreItem } from "../types";

interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  refresh_token: string;
}

export async function handleTokenExchange(
  body: TokenRequest,
  getOAuthItem: (pk: string, sk: string) => Promise<OAuthStoreItem | null>,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>,
  deleteOAuthItem: (pk: string, sk: string) => Promise<void>
): Promise<TokenResponse> {
  if (body.grant_type === "authorization_code") {
    return handleAuthCodeExchange(body, getOAuthItem, putOAuthItem, deleteOAuthItem);
  }

  if (body.grant_type === "refresh_token") {
    return handleRefreshTokenExchange(body, getOAuthItem, putOAuthItem, deleteOAuthItem);
  }

  throw new Error("unsupported_grant_type");
}

async function handleAuthCodeExchange(
  body: TokenRequest,
  getOAuthItem: (pk: string, sk: string) => Promise<OAuthStoreItem | null>,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>,
  deleteOAuthItem: (pk: string, sk: string) => Promise<void>
): Promise<TokenResponse> {
  if (!body.code) throw new Error("invalid_request: missing code");
  if (!body.code_verifier) throw new Error("invalid_request: missing code_verifier");
  if (!body.redirect_uri) throw new Error("invalid_request: missing redirect_uri");

  const stored = await getOAuthItem(`CODE#${body.code}`, "AUTH");
  if (!stored) throw new Error("invalid_grant: code not found or expired");

  const codeData = JSON.parse(stored.data);

  // Verify redirect_uri matches
  if (codeData.redirectUri !== body.redirect_uri) {
    throw new Error("invalid_grant: redirect_uri mismatch");
  }

  // Verify PKCE
  if (
    !verifyCodeChallenge(
      body.code_verifier,
      codeData.codeChallenge,
      codeData.codeChallengeMethod
    )
  ) {
    throw new Error("invalid_grant: code_verifier failed");
  }

  // Delete the used code (one-time use)
  await deleteOAuthItem(`CODE#${body.code}`, "AUTH");

  // Issue tokens
  const accessToken = await signAccessToken(codeData.userId);
  const refreshToken = generateRefreshToken();

  // Store refresh token (30 day TTL)
  await putOAuthItem({
    pk: `REFRESH#${refreshToken}`,
    sk: "TOKEN",
    data: JSON.stringify({ userId: codeData.userId, clientId: codeData.clientId, refreshedAt: Date.now() }),
    ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });

  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
  };
}

async function handleRefreshTokenExchange(
  body: TokenRequest,
  getOAuthItem: (pk: string, sk: string) => Promise<OAuthStoreItem | null>,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>,
  deleteOAuthItem: (pk: string, sk: string) => Promise<void>
): Promise<TokenResponse> {
  if (!body.refresh_token) throw new Error("invalid_request: missing refresh_token");

  const stored = await getOAuthItem(`REFRESH#${body.refresh_token}`, "TOKEN");
  if (!stored) throw new Error("invalid_grant: refresh_token not found or expired");

  const tokenData = JSON.parse(stored.data);

  // Rotate: delete old refresh token, issue new pair
  await deleteOAuthItem(`REFRESH#${body.refresh_token}`, "TOKEN");

  const accessToken = await signAccessToken(tokenData.userId);
  const newRefreshToken = generateRefreshToken();

  await putOAuthItem({
    pk: `REFRESH#${newRefreshToken}`,
    sk: "TOKEN",
    data: JSON.stringify({ userId: tokenData.userId, clientId: tokenData.clientId, refreshedAt: Date.now() }),
    ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });

  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: newRefreshToken,
  };
}
