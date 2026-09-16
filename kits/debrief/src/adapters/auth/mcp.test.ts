import { describe, expect, it } from "vitest";
import {
  createAppRegistry,
  issueAppToken,
  registerApp,
} from "./index.js";
import {
  authenticateMcpRequest,
  signInternalSignedMcpToken,
} from "./mcp.js";

const SECRET = "demo-secret-that-is-at-least-32-bytes-long";

function request(authorization?: string): Request {
  return new Request("http://localhost/mcp", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("demo MCP authentication boundary", () => {
  it("returns an explicitly unauthenticated context in auth-none mode", async () => {
    await expect(authenticateMcpRequest(request(), { mode: "none" })).resolves.toEqual({
      mode: "none",
      authenticated: false,
      appId: null,
      org: null,
      scopes: [],
    });
  });

  it("requires a bearer token in app-token mode", async () => {
    const registry = createAppRegistry({ secret: SECRET });

    await expect(authenticateMcpRequest(request(), { mode: "app-token", registry }))
      .rejects.toMatchObject({ code: "missing_bearer" });
  });

  it("rejects invalid app tokens without falling back to auth-none", async () => {
    const registry = createAppRegistry({ secret: SECRET });

    await expect(authenticateMcpRequest(request("Bearer not-a-token"), {
      mode: "app-token",
      registry,
    })).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("verifies a valid app token and returns its identity", async () => {
    const registry = createAppRegistry({ secret: SECRET, now: () => 1_700_000_000_000 });
    const app = registerApp(registry, {
      id: "app-sales",
      name: "Sales voice demo",
      org: "org-demo",
      scopes: ["mcp", "inference"],
    });
    const token = await issueAppToken(registry, app.id);

    await expect(authenticateMcpRequest(request(`Bearer ${token}`), {
      mode: "app-token",
      registry,
      requiredScopes: ["mcp"],
    })).resolves.toMatchObject({
      mode: "app-token",
      authenticated: true,
      appId: "app-sales",
      org: "org-demo",
      scopes: ["mcp", "inference"],
    });
  });

  it("rejects a valid token that lacks a required scope", async () => {
    const registry = createAppRegistry({ secret: SECRET });
    const app = registerApp(registry, {
      id: "app-sales",
      name: "Sales voice demo",
      org: "org-demo",
      scopes: ["inference"],
    });
    const token = await issueAppToken(registry, app.id);

    await expect(authenticateMcpRequest(request(`Bearer ${token}`), {
      mode: "app-token",
      registry,
      requiredScopes: ["mcp"],
    })).rejects.toMatchObject({ code: "insufficient_scope" });
  });

  it("fails closed when app-token mode has no registry", async () => {
    await expect(authenticateMcpRequest(request(), { mode: "app-token" }))
      .rejects.toMatchObject({ code: "misconfigured" });
  });

  it("verifies an internal router identity and enforces the user/org allowlist", async () => {
    const now = 1_700_000_000_000;
    const token = await signInternalSignedMcpToken({
      userId: "user-1",
      org: "org-demo",
      req: "request-1",
      trace: "trace-1",
    }, { secret: SECRET, now: () => now });

    await expect(authenticateMcpRequest(request(`Bearer ${token}`), {
      mode: "internal-signed",
      internalSecret: SECRET,
      internalUserOrgAllowlist: { "user-1": "org-demo" },
      now: () => now,
    })).resolves.toMatchObject({
      mode: "internal-signed",
      authenticated: true,
      appId: null,
      org: "org-demo",
      claims: {
        sub: "user-1",
        org: "org-demo",
        kit: "debrief",
        req: "request-1",
        trace: "trace-1",
      },
    });
  });

  it("rejects a signed identity for an unknown user", async () => {
    const token = await signInternalSignedMcpToken({
      userId: "unknown-user",
      org: "org-demo",
      req: "request-1",
      trace: "trace-1",
    }, { secret: SECRET });

    await expect(authenticateMcpRequest(request(`Bearer ${token}`), {
      mode: "internal-signed",
      internalSecret: SECRET,
      internalUserOrgAllowlist: { "user-1": "org-demo" },
    })).rejects.toMatchObject({ code: "forbidden_identity" });
  });

  it("rejects a tampered internal identity", async () => {
    const token = await signInternalSignedMcpToken({
      userId: "user-1",
      org: "org-demo",
      req: "request-1",
      trace: "trace-1",
    }, { secret: SECRET });

    await expect(authenticateMcpRequest(request(`Bearer ${token}x`), {
      mode: "internal-signed",
      internalSecret: SECRET,
      internalUserOrgAllowlist: { "user-1": "org-demo" },
    })).rejects.toMatchObject({ code: "invalid_token" });
  });
});
