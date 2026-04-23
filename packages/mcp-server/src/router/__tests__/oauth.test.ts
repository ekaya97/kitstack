import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  verifyCodeChallenge,
  signAccessToken,
  verifyAccessToken,
  generateAuthCode,
} from "../oauth/helpers";
import { getOAuthMetadata } from "../oauth/metadata";
import { handleRegister } from "../oauth/register";
import { validateAuthorizeRequest, issueAuthCode } from "../oauth/authorize";
import { handleTokenExchange } from "../oauth/token";
import type { OAuthStoreItem } from "../../framework/types";

beforeEach(() => {
  vi.stubEnv("MCP_JWT_SECRET", "test-secret-that-is-at-least-32-chars-long!");
});

// --- PKCE ---

describe("verifyCodeChallenge", () => {
  it("verifies S256 challenge correctly", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    expect(verifyCodeChallenge(verifier, challenge, "S256")).toBe(true);
  });

  it("rejects wrong verifier", () => {
    const challenge = crypto
      .createHash("sha256")
      .update("correct-verifier")
      .digest("base64url");
    expect(verifyCodeChallenge("wrong-verifier", challenge, "S256")).toBe(false);
  });
});

// --- Access Tokens ---

describe("access tokens", () => {
  it("signs and verifies a token", async () => {
    const token = await signAccessToken("user-123");
    const result = await verifyAccessToken(token);
    expect(result.userId).toBe("user-123");
  });

  it("rejects tampered token", async () => {
    const token = await signAccessToken("user-123");
    await expect(verifyAccessToken(token + "X")).rejects.toThrow();
  });
});

// --- Metadata ---

describe("getOAuthMetadata", () => {
  it("returns correct endpoints", () => {
    const meta = getOAuthMetadata("https://mcp.kitstack.co");
    expect(meta.authorization_endpoint).toBe("https://mcp.kitstack.co/authorize");
    expect(meta.token_endpoint).toBe("https://mcp.kitstack.co/token");
    expect(meta.registration_endpoint).toBe("https://mcp.kitstack.co/register");
    expect(meta.code_challenge_methods_supported).toContain("S256");
  });
});

// --- Register ---

describe("handleRegister", () => {
  it("registers a client and returns credentials", async () => {
    const putItem = vi.fn();
    const result = await handleRegister(
      { redirect_uris: ["https://claude.ai/callback"] },
      putItem
    );
    expect(result.client_id).toMatch(/^kitstack_/);
    expect(result.client_secret).toBeDefined();
    expect(result.redirect_uris).toEqual(["https://claude.ai/callback"]);
    expect(putItem).toHaveBeenCalledOnce();
  });

  it("throws without redirect_uris", async () => {
    await expect(
      handleRegister({ redirect_uris: [] }, vi.fn())
    ).rejects.toThrow("redirect_uris");
  });
});

// --- Authorize ---

describe("validateAuthorizeRequest", () => {
  it("validates a correct request", () => {
    const result = validateAuthorizeRequest({
      response_type: "code",
      client_id: "kitstack_abc",
      redirect_uri: "https://claude.ai/callback",
      code_challenge: "abc123",
      code_challenge_method: "S256",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing code_challenge", () => {
    const result = validateAuthorizeRequest({
      response_type: "code",
      client_id: "kitstack_abc",
      redirect_uri: "https://claude.ai/callback",
      code_challenge: "",
      code_challenge_method: "S256",
    });
    expect(result.valid).toBe(false);
  });
});

// --- Token Exchange (full flow) ---

describe("handleTokenExchange", () => {
  it("exchanges an auth code for tokens", async () => {
    const store = new Map<string, OAuthStoreItem>();
    const putItem = vi.fn(async (item: OAuthStoreItem) => {
      store.set(`${item.pk}#${item.sk}`, item);
    });
    const getItem = vi.fn(async (pk: string, sk: string) => {
      return store.get(`${pk}#${sk}`) || null;
    });
    const deleteItem = vi.fn(async (pk: string, sk: string) => {
      store.delete(`${pk}#${sk}`);
    });

    // Step 1: Issue an auth code
    const codeVerifier = "test-verifier-that-is-long-enough-for-pkce";
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const code = await issueAuthCode(
      "user-456",
      {
        response_type: "code",
        client_id: "kitstack_test",
        redirect_uri: "https://claude.ai/callback",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      putItem
    );

    // Step 2: Exchange code for tokens
    const result = await handleTokenExchange(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://claude.ai/callback",
        code_verifier: codeVerifier,
        client_id: "kitstack_test",
      },
      getItem,
      putItem,
      deleteItem
    );

    expect(result.access_token).toBeDefined();
    expect(result.token_type).toBe("bearer");
    expect(result.expires_in).toBe(3600);
    expect(result.refresh_token).toBeDefined();

    // Verify the access token
    const auth = await verifyAccessToken(result.access_token);
    expect(auth.userId).toBe("user-456");
  });

  it("rejects invalid code_verifier", async () => {
    const store = new Map<string, OAuthStoreItem>();
    const putItem = vi.fn(async (item: OAuthStoreItem) => {
      store.set(`${item.pk}#${item.sk}`, item);
    });
    const getItem = vi.fn(async (pk: string, sk: string) => {
      return store.get(`${pk}#${sk}`) || null;
    });
    const deleteItem = vi.fn();

    const codeChallenge = crypto
      .createHash("sha256")
      .update("correct-verifier")
      .digest("base64url");

    const code = await issueAuthCode(
      "user-789",
      {
        response_type: "code",
        client_id: "kitstack_test",
        redirect_uri: "https://example.com/cb",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      putItem
    );

    await expect(
      handleTokenExchange(
        {
          grant_type: "authorization_code",
          code,
          redirect_uri: "https://example.com/cb",
          code_verifier: "wrong-verifier",
        },
        getItem,
        putItem,
        deleteItem
      )
    ).rejects.toThrow("code_verifier failed");
  });

  it("rejects expired/missing code", async () => {
    const getItem = vi.fn(async () => null);
    await expect(
      handleTokenExchange(
        {
          grant_type: "authorization_code",
          code: "nonexistent",
          redirect_uri: "https://example.com/cb",
          code_verifier: "verifier",
        },
        getItem,
        vi.fn(),
        vi.fn()
      )
    ).rejects.toThrow("not found or expired");
  });
});
