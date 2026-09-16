import {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import crypto from "node:crypto";
import type { McpRequestIdentity } from "../authz";

export interface OidcClaims extends JWTPayload {
  tid?: string;
  oid?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
  roles?: string[];
}

export interface FederatedUser {
  userId: string;
  provider: "oidc";
  issuer: string;
  tenantId: string;
  subject: string;
  objectId?: string;
  email?: string;
  name?: string;
  groups: string[];
  roles: string[];
}

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export interface OidcFederationConfig {
  /** Exact OIDC issuer URLs accepted by the router. */
  issuerAllowlist: readonly string[];
  /** Exact tenant IDs accepted from the verified `tid` claim. */
  tenantAllowlist: readonly string[];
  /** OIDC audience(s), normally the KitStack app registration client ID. */
  audience: string | readonly string[];
  /** Optional default client ID used when constructing authorization requests. */
  clientId?: string;
  /** Claims-to-user mapping override. The default is stable and content-free. */
  mapUser?: (claims: OidcClaims, issuer: string, tenantId: string) => FederatedUser;
  /** Injectable fetch for discovery; JWT keys are fetched by jose from the local/remote issuer. */
  fetch?: typeof fetch;
  /** Additional clock tolerance passed to jose. */
  clockTolerance?: number;
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface OidcAuthorizationRequest {
  issuer?: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
  nonce?: string;
}

export interface OidcTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  [key: string]: unknown;
}

export interface FederatedAuthentication {
  tokens: OidcTokenResponse;
  user: FederatedUser;
  identity: McpRequestIdentity;
  claims: OidcClaims;
}

export interface ExchangeCodeParams {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  nonce?: string;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Normalize an issuer for exact allowlist comparisons. */
export function normalizeIssuer(value: string): string {
  const issuer = trimTrailingSlash(value);
  let parsed: URL;
  try {
    parsed = new URL(issuer);
  } catch {
    throw new Error("OIDC issuer must be an absolute URL");
  }

  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("OIDC issuer must use HTTPS (HTTP is only allowed for localhost test issuers)");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("OIDC issuer must not contain credentials, query parameters, or fragments");
  }
  return parsed.toString().replace(/\/$/, "");
}

function normalizeAllowlist(values: readonly string[], name: string): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error(`OIDC ${name} allowlist must not be empty`);
  const canonical = name === "issuer" ? normalized.map(normalizeIssuer) : normalized;
  return [...new Set(canonical)];
}

function audiencesMatch(audience: string | readonly string[], value: string): boolean {
  return (Array.isArray(audience) ? audience : [audience]).includes(value);
}

function defaultMapUser(claims: OidcClaims, issuer: string, tenantId: string): FederatedUser {
  if (!claims.sub) throw new Error("OIDC identity is missing sub");
  return {
    userId: `oidc:${tenantId}:${claims.sub}`,
    provider: "oidc",
    issuer,
    tenantId,
    subject: claims.sub,
    objectId: claims.oid,
    email: claims.email ?? claims.preferred_username,
    name: claims.name,
    groups: Array.isArray(claims.groups) ? claims.groups.filter((v): v is string => typeof v === "string") : [],
    roles: Array.isArray(claims.roles) ? claims.roles.filter((v): v is string => typeof v === "string") : [],
  };
}

function identityForUser(user: FederatedUser): McpRequestIdentity {
  return {
    principal: user.userId,
    actor: user.userId,
    kind: "interactive",
  };
}

function parseJsonResponse(response: Response, label: string): Promise<Record<string, unknown>> {
  if (!response.ok) {
    return response.text().then((body) => {
      throw new Error(`${label} failed with HTTP ${response.status}: ${body.slice(0, 200)}`);
    });
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function isS256CodeChallenge(value: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  try {
    return Buffer.from(value, "base64url").length === 32;
  } catch {
    return false;
  }
}

/** Reject alternate base64url spellings that can decode to the same bytes. */
function assertCanonicalJwtEncoding(token: string): void {
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !segment || !/^[A-Za-z0-9_-]+$/.test(segment))) {
    throw new Error("OIDC token has an invalid compact serialization");
  }
  for (const segment of segments) {
    if (Buffer.from(segment, "base64url").toString("base64url") !== segment) {
      throw new Error("OIDC token has a non-canonical base64url segment");
    }
  }
}

/** Generate a standards-compliant S256 PKCE pair for a public client. */
export function createPkcePair(): PkcePair {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge, codeChallengeMethod: "S256" };
}

/** Verify S256 PKCE using a constant-time comparison. Plain PKCE is intentionally unsupported. */
export function verifyPkce(codeVerifier: string, codeChallenge: string, method = "S256"): boolean {
  if (!codeVerifier || !codeChallenge || method !== "S256") return false;
  const expected = crypto.createHash("sha256").update(codeVerifier).digest();
  let received: Buffer;
  try {
    received = Buffer.from(codeChallenge, "base64url");
  } catch {
    return false;
  }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * OIDC federation primitives used by the MCP router. The adapter is deliberately
 * issuer- and tenant-bound; it never accepts an issuer or tenant merely because
 * those values appeared in an unverified token.
 */
export function createOidcFederation(config: OidcFederationConfig) {
  const issuerAllowlist = normalizeAllowlist(config.issuerAllowlist, "issuer");
  const tenantAllowlist = normalizeAllowlist(config.tenantAllowlist, "tenant");
  const audience: string | string[] = Array.isArray(config.audience) ? [...config.audience] : config.audience;
  if ((Array.isArray(audience) && audience.length === 0) || (!Array.isArray(audience) && !audience.trim())) {
    throw new Error("OIDC audience must not be empty");
  }
  const fetchImpl = config.fetch ?? fetch;
  const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();
  const jwksCache = new Map<string, JWTVerifyGetKey>();

  function resolveIssuer(value?: string): string {
    if (!value) {
      if (issuerAllowlist.length !== 1) {
        throw new Error("OIDC issuer is required when multiple issuers are allowlisted");
      }
      return issuerAllowlist[0];
    }
    const normalized = normalizeIssuer(value);
    if (!issuerAllowlist.includes(normalized)) throw new Error("OIDC issuer is not allowlisted");
    return normalized;
  }

  async function discover(value?: string): Promise<OidcDiscoveryDocument> {
    const issuer = resolveIssuer(value);
    const cached = discoveryCache.get(issuer);
    if (cached) return cached;

    const request = (async () => {
      const response = await fetchImpl(`${issuer}/.well-known/openid-configuration`, {
        headers: { Accept: "application/json" },
      });
      const document = await parseJsonResponse(response, "OIDC discovery") as unknown as OidcDiscoveryDocument;
      if (typeof document.issuer !== "string" || normalizeIssuer(document.issuer) !== issuer) {
        throw new Error("OIDC discovery issuer mismatch");
      }
      if (!document.jwks_uri || !document.authorization_endpoint || !document.token_endpoint) {
        throw new Error("OIDC discovery document is missing required endpoints");
      }
      const jwksUrl = new URL(document.jwks_uri);
      const local = jwksUrl.hostname === "localhost" || jwksUrl.hostname === "127.0.0.1";
      if (jwksUrl.protocol !== "https:" && !(local && jwksUrl.protocol === "http:")) {
        throw new Error("OIDC jwks_uri must use HTTPS (HTTP is only allowed for localhost test issuers)");
      }
      return document;
    })();
    discoveryCache.set(issuer, request);
    try {
      return await request;
    } catch (error) {
      discoveryCache.delete(issuer);
      throw error;
    }
  }

  async function validateIdToken(token: string, options: { issuer?: string; nonce?: string } = {}): Promise<FederatedAuthentication> {
    if (!token) throw new Error("OIDC id_token is required");
    assertCanonicalJwtEncoding(token);
    const untrustedIssuer = decodeJwt(token).iss;
    const issuer = resolveIssuer(options.issuer ?? untrustedIssuer);
    if (untrustedIssuer !== issuer) throw new Error("OIDC token issuer is not allowlisted");
    const header = decodeProtectedHeader(token);
    if (!header.alg || !["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"].includes(header.alg)) {
      throw new Error("OIDC token uses an unsupported signing algorithm");
    }
    const document = await discover(issuer);
    let jwks = jwksCache.get(document.jwks_uri);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(document.jwks_uri));
      jwksCache.set(document.jwks_uri, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"],
      clockTolerance: config.clockTolerance,
    });
    const claims = payload as OidcClaims;
    const tenantId = typeof claims.tid === "string" ? claims.tid : "";
    if (!tenantId || !tenantAllowlist.includes(tenantId)) throw new Error("OIDC tenant is not allowlisted");
    if (options.nonce !== undefined && claims.nonce !== options.nonce) throw new Error("OIDC nonce mismatch");
    if (!claims.sub) throw new Error("OIDC identity is missing sub");

    const user = (config.mapUser ?? defaultMapUser)(claims, issuer, tenantId);
    if (!user.userId || !user.userId.trim()) throw new Error("OIDC user mapping returned an empty userId");
    return { tokens: { access_token: "", token_type: "Bearer", id_token: token }, user, identity: identityForUser(user), claims };
  }

  async function authorizationUrl(request: OidcAuthorizationRequest): Promise<string> {
    if (!request.state) throw new Error("OIDC authorization requires state");
    if (!isS256CodeChallenge(request.codeChallenge)) {
      throw new Error("OIDC authorization requires a valid S256 code challenge");
    }
    const issuer = resolveIssuer(request.issuer);
    const document = await discover(issuer);
    const clientId = config.clientId;
    if (!clientId) throw new Error("OIDC clientId is required for authorization requests");
    const url = new URL(document.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("scope", request.scope ?? "openid profile email");
    url.searchParams.set("state", request.state);
    url.searchParams.set("code_challenge", request.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (request.nonce) url.searchParams.set("nonce", request.nonce);
    return url.toString();
  }

  async function exchangeCode(request: ExchangeCodeParams): Promise<FederatedAuthentication> {
    if (!request.code || !request.codeVerifier) throw new Error("OIDC code and code_verifier are required");
    const issuer = resolveIssuer(request.issuer);
    const document = await discover(issuer);
    const clientId = request.clientId ?? config.clientId;
    if (!clientId) throw new Error("OIDC clientId is required for token exchange");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: request.code,
      redirect_uri: request.redirectUri,
      client_id: clientId,
      code_verifier: request.codeVerifier,
    });
    if (request.clientSecret) body.set("client_secret", request.clientSecret);
    const response = await fetchImpl(document.token_endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const raw = await parseJsonResponse(response, "OIDC token exchange");
    if (typeof raw.id_token !== "string") throw new Error("OIDC token response is missing id_token");
    const authentication = await validateIdToken(raw.id_token, { issuer, nonce: request.nonce });
    return { ...authentication, tokens: raw as OidcTokenResponse };
  }

  return {
    issuerAllowlist: [...issuerAllowlist],
    tenantAllowlist: [...tenantAllowlist],
    discover,
    validateIdToken,
    authorizationUrl,
    exchangeCode,
  };
}

export function federationFromEnvironment(env: Record<string, string | undefined> = process.env): OidcFederationConfig {
  const list = (value: string | undefined) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const audience = list(env.KITSTACK_OIDC_AUDIENCES ?? env.KITSTACK_OIDC_AUDIENCE);
  const issuers = list(env.KITSTACK_OIDC_ISSUERS ?? env.KITSTACK_OIDC_ISSUER).map(normalizeIssuer);
  const tenants = [...new Set(list(env.KITSTACK_OIDC_TENANTS ?? env.KITSTACK_OIDC_TENANT_ALLOWLIST))];
  return {
    issuerAllowlist: [...new Set(issuers)],
    tenantAllowlist: tenants,
    audience: audience.length === 1 ? audience[0] : audience,
    clientId: env.KITSTACK_OIDC_CLIENT_ID,
  };
}
