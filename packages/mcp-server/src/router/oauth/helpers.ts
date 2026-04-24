import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { Resource } from "sst";

const getSecret = () => new TextEncoder().encode(Resource.McpJwtSecret.value);

// --- PKCE ---

export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: "S256" | "plain" = "S256"
): boolean {
  if (method === "plain") return codeVerifier === codeChallenge;
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const computed = hash.toString("base64url");
  return computed === codeChallenge;
}

// --- Authorization Codes ---

export function generateAuthCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// --- Access Tokens (JWT) ---

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ scope: "mcp" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  if (!payload.sub) throw new Error("Invalid access token: missing sub");
  return { userId: payload.sub };
}

// --- Refresh Tokens ---

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

// --- Client ID ---

export function generateClientId(): string {
  return `kitstack_${crypto.randomBytes(16).toString("hex")}`;
}

export function generateClientSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}
