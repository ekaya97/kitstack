import { describe, expect, it, vi } from "vitest";
import {
  authorizeToolInvocation,
  interactiveIdentity,
  type McpRequestIdentity,
  type TupleChecker,
} from "../authz";

const KIT = "crm-kit";

function checker(allowed: boolean | ((subjectId: string, subjectType: string) => boolean)): TupleChecker {
  return vi.fn(async (subjectId, _relation, _objectType, _objectId, subjectType = "user") =>
    typeof allowed === "function" ? allowed(subjectId, subjectType) : allowed,
  );
}

describe("router platform authorization", () => {
  it("uses kit:use for an interactive assist call", async () => {
    const check = checker(true);

    await expect(authorizeToolInvocation({
      identity: interactiveIdentity("user-1"),
      mode: "assist",
      kitSlug: KIT,
    }, check)).resolves.toEqual({
      allowed: true,
      reason: undefined,
    });

    expect(check).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith("user-1", "kit:use", "kit", KIT, "user");
  });

  it("uses kit:act for an interactive act call and does not fall back to kit:use", async () => {
    const check = checker(false);

    await expect(authorizeToolInvocation({
      identity: interactiveIdentity("user-1"),
      mode: "act",
      kitSlug: KIT,
    }, check)).resolves.toMatchObject({
      allowed: false,
      reason: "Missing kit:act on kit:crm-kit",
    });

    expect(check).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith("user-1", "kit:act", "kit", KIT, "user");
  });

  it("requires both principal and service grants for delegated act calls", async () => {
    const identity: McpRequestIdentity = {
      principal: "user-1",
      actor: "service:voice-agent",
      kind: "delegated",
      delegation: "delegation-1",
    };
    const check = checker((subjectId, subjectType) =>
      subjectType === "user" && subjectId === "user-1",
    );

    await expect(authorizeToolInvocation({ identity, mode: "act", kitSlug: KIT }, check))
      .resolves.toMatchObject({ allowed: false, reason: "Missing kit:act on kit:crm-kit for service actor" });
    expect(check).toHaveBeenNthCalledWith(1, "user-1", "kit:act", "kit", KIT, "user");
    expect(check).toHaveBeenNthCalledWith(2, "service:voice-agent", "kit:act", "kit", KIT, "service");
  });

  it("rejects a service identity that presents a user principal", async () => {
    const check = checker(true);
    const identity: McpRequestIdentity = {
      principal: "user-1",
      actor: "service:nightly-job",
      kind: "service",
    };

    await expect(authorizeToolInvocation({ identity, mode: "act", kitSlug: KIT }, check))
      .resolves.toEqual({
        allowed: false,
        reason: "Service identity cannot impersonate a user principal",
      });
    expect(check).not.toHaveBeenCalled();
  });

  it("authorizes a non-impersonating service identity against service grants", async () => {
    const check = checker(true);
    const identity: McpRequestIdentity = {
      principal: "service:nightly-job",
      actor: "service:nightly-job",
      kind: "service",
    };

    await expect(authorizeToolInvocation({ identity, mode: "act", kitSlug: KIT }, check))
      .resolves.toMatchObject({ allowed: true });
    expect(check).toHaveBeenCalledWith(
      "service:nightly-job",
      "kit:act",
      "kit",
      KIT,
      "service",
    );
  });
});
