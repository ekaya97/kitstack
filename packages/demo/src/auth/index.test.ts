import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import {
  createAppRegistry,
  issueAppToken,
  registerApp,
  verifyAppToken,
} from "./index.js";

const SECRET = "demo-secret-that-is-at-least-32-bytes-long";

describe("developer app tokens", () => {
  it("registers an app and issues exactly the documented claims", async () => {
    const registry = createAppRegistry({ secret: SECRET, now: () => 1_700_000_000_000 });
    const app = registerApp(registry, {
      id: "app-sales",
      name: "Sales voice demo",
      org: "org-demo",
      scopes: ["inference", "observability"],
    });
    const token = await issueAppToken(registry, app.id);
    const payload = decodeJwt(token);

    expect(Object.keys(payload).sort()).toEqual(["exp", "org", "scopes", "sub"]);
    await expect(verifyAppToken(registry, token)).resolves.toEqual({
      sub: "app-sales",
      org: "org-demo",
      scopes: ["inference", "observability"],
      exp: 1_700_000_900,
    });
  });

  it("rejects an expired token and a token signed by another registry", async () => {
    let now = 1_700_000_000_000;
    const registry = createAppRegistry({ secret: SECRET, tokenTtlSeconds: 1, now: () => now });
    registerApp(registry, { id: "app-sales", name: "Sales", org: "org-demo" });
    const token = await issueAppToken(registry, "app-sales");

    now += 2_000;
    await expect(verifyAppToken(registry, token)).rejects.toThrow();

    const other = createAppRegistry({ secret: "another-secret-that-is-at-least-32-bytes-long" });
    registerApp(other, { id: "app-sales", name: "Sales", org: "org-demo" });
    await expect(verifyAppToken(other, token)).rejects.toThrow();
  });

  it("keeps registration separate and rejects an unregistered app claim", async () => {
    const issuer = createAppRegistry({ secret: SECRET });
    registerApp(issuer, { id: "app-other", name: "Other", org: "org-demo" });
    const token = await issueAppToken(issuer, "app-other");

    const verifier = createAppRegistry({ secret: SECRET });
    await expect(verifyAppToken(verifier, token)).rejects.toThrow("not registered");
  });
});
