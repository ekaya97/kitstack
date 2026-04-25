import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAppToken, verifyAppToken } from "../app-token";

beforeEach(() => {
  vi.stubEnv("MCP_JWT_SECRET", "test-secret-that-is-at-least-32-chars-long!");
});

describe("signAppToken + verifyAppToken", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signAppToken({ sub: "user-123", kit: "crm" });
    expect(typeof token).toBe("string");

    const payload = await verifyAppToken(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.kit).toBe("crm");
  });

  it("rejects a tampered token", async () => {
    const token = await signAppToken({ sub: "user-123", kit: "crm" });
    const tampered = token.slice(0, -5) + "XXXXX";
    await expect(verifyAppToken(tampered)).rejects.toThrow();
  });

  it("rejects token with wrong secret", async () => {
    const token = await signAppToken({ sub: "user-123", kit: "crm" });
    vi.stubEnv("MCP_JWT_SECRET", "different-secret-that-is-also-32-chars!!");
    await expect(verifyAppToken(token)).rejects.toThrow();
  });

  it("throws if MCP_JWT_SECRET is not set", async () => {
    vi.stubEnv("MCP_JWT_SECRET", "");
    await expect(
      signAppToken({ sub: "user-1", kit: "crm" })
    ).rejects.toThrow("MCP_JWT_SECRET");
  });
});
