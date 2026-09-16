import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { exportJWK, SignJWT } from "jose";
import {
  createOidcFederation,
  createPkcePair,
  federationFromEnvironment,
  verifyPkce,
} from "../oauth/federation";
import { getProtectedResourceMetadata } from "../oauth/metadata";

describe("OIDC federation", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let server: Server;
  let issuer = "";
  let jwk: Record<string, unknown>;

  beforeAll(async () => {
    const exported = await exportJWK(publicKey);
    jwk = { ...exported, kid: "local-key", use: "sig", alg: "RS256" };
    server = createServer(async (request, response) => {
      if (request.url === "/.well-known/openid-configuration") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
        }));
        return;
      }
      if (request.url === "/jwks") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      if (request.url === "/token") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ access_token: "local-access", token_type: "Bearer", id_token: await signedToken() }));
        return;
      }
      response.statusCode = 404;
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("local issuer failed to start");
    issuer = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function signedToken(overrides: Record<string, unknown> = {}) {
    return new SignJWT({
      tid: "tenant-local",
      oid: "object-123",
      email: "rep@example.test",
      name: "Demo Rep",
      groups: ["sales"],
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: "local-key" })
      .setIssuer(issuer)
      .setAudience("kitstack-local-client")
      .setSubject("subject-123")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  function federation(extra: Partial<Parameters<typeof createOidcFederation>[0]> = {}) {
    return createOidcFederation({
      issuerAllowlist: [issuer],
      tenantAllowlist: ["tenant-local"],
      audience: "kitstack-local-client",
      clientId: "kitstack-local-client",
      ...extra,
    });
  }

  it("generates and verifies S256 PKCE, rejecting plain PKCE", () => {
    const pair = createPkcePair();
    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyPkce(pair.codeVerifier, pair.codeChallenge, pair.codeChallengeMethod)).toBe(true);
    expect(verifyPkce(pair.codeVerifier, pair.codeChallenge, "plain")).toBe(false);
    expect(verifyPkce("wrong-verifier", pair.codeChallenge)).toBe(false);
  });

  it("validates a locally-issued JWT through discovery and JWKS, then maps the user", async () => {
    const result = await federation().validateIdToken(await signedToken());
    expect(result.user).toMatchObject({
      userId: "oidc:tenant-local:subject-123",
      provider: "oidc",
      objectId: "object-123",
      email: "rep@example.test",
      groups: ["sales"],
    });
    expect(result.identity).toEqual({
      principal: "oidc:tenant-local:subject-123",
      actor: "oidc:tenant-local:subject-123",
      kind: "interactive",
    });
  });

  it("rejects an unallowlisted tenant, audience, issuer, and tampered signature", async () => {
    await expect(federation().validateIdToken(await signedToken({ tid: "other-tenant" })))
      .rejects.toThrow("tenant is not allowlisted");
    await expect(createOidcFederation({
      issuerAllowlist: [issuer], tenantAllowlist: ["tenant-local"], audience: "wrong-client",
    }).validateIdToken(await signedToken())).rejects.toThrow();
    await expect(createOidcFederation({
      issuerAllowlist: ["http://127.0.0.1:1"], tenantAllowlist: ["tenant-local"], audience: "kitstack-local-client",
    }).validateIdToken(await signedToken())).rejects.toThrow("issuer is not allowlisted");
    const token = await signedToken();
    await expect(federation().validateIdToken(`${token.slice(0, -1)}x`)).rejects.toThrow();
  });

  it("builds a PKCE authorization URL and exchanges a code through the local issuer", async () => {
    const pair = createPkcePair();
    const instance = federation();
    const authorizationUrl = await instance.authorizationUrl({
      redirectUri: "https://claude.ai/callback",
      state: "state-123",
      codeChallenge: pair.codeChallenge,
    });
    const parsed = new URL(authorizationUrl);
    expect(parsed.searchParams.get("client_id")).toBe("kitstack-local-client");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("state-123");

    const exchanged = await instance.exchangeCode({
      code: "local-code",
      redirectUri: "https://claude.ai/callback",
      codeVerifier: pair.codeVerifier,
    });
    expect(exchanged.tokens.access_token).toBe("local-access");
    expect(exchanged.user.userId).toBe("oidc:tenant-local:subject-123");
  });

  it("supports an explicit claims-to-user mapping", async () => {
    const result = await federation({
      mapUser: (claims, issuerValue, tenantId) => ({
        userId: `internal:${claims.oid}`,
        provider: "oidc",
        issuer: issuerValue,
        tenantId,
        subject: claims.sub!,
        groups: [],
        roles: [],
      }),
    }).validateIdToken(await signedToken());
    expect(result.user.userId).toBe("internal:object-123");
  });

  it("parses deployment configuration from environment", () => {
    const config = federationFromEnvironment({
      KITSTACK_OIDC_ISSUERS: `${issuer}, ${issuer}/`,
      KITSTACK_OIDC_TENANTS: "tenant-local",
      KITSTACK_OIDC_AUDIENCE: "kitstack-local-client",
      KITSTACK_OIDC_CLIENT_ID: "kitstack-local-client",
    });
    expect(config.issuerAllowlist).toEqual([issuer]);
    expect(config.tenantAllowlist).toEqual(["tenant-local"]);
    expect(config.audience).toBe("kitstack-local-client");
  });
});

describe("Protected Resource Metadata", () => {
  it("advertises the resource and authorization server for MCP discovery", () => {
    expect(getProtectedResourceMetadata("https://mcp.example.test/", "https://mcp.example.test/")).toEqual({
      resource: "https://mcp.example.test",
      authorization_servers: ["https://mcp.example.test"],
      scopes_supported: ["mcp"],
      bearer_methods_supported: ["header"],
    });
  });
});
