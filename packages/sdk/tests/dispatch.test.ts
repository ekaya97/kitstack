import { describe, expect, it } from "vitest";
import {
  createDispatchEnvelope,
  dispatch,
  type DispatchTarget,
} from "../src/server/dispatch";
import { createDispatchAuditSink, HashChainedAuditStore } from "../src/audit";
import { kit } from "../src/result";

const target: DispatchTarget = {
  kitId: "sales",
  command: "close_deal",
  validate: (args) =>
    typeof args.dealId === "string"
      ? { success: true, data: args }
      : { success: false, message: "dealId: Required" },
  authorize: (args) => [
    { relation: "editor", objectType: "deal", objectId: String(args.dealId) },
  ],
};

function envelope(args: Record<string, unknown> = { dealId: "deal-1" }) {
  return createDispatchEnvelope({
    kitId: "sales",
    command: "close_deal",
    args,
    principal: "user-1",
  });
}

describe("dispatch", () => {
  it("runs resolution, validation, grants, and invocation in order", async () => {
    const steps: string[] = [];
    const result = await dispatch(envelope(), {
      resolve: async () => {
        steps.push("resolve");
        return { target };
      },
      createContext: () => {
        steps.push("context");
        return {} as never;
      },
      checkGrant: async (_envelope, requirements) => {
        steps.push(`grant:${requirements[0]?.objectId}`);
        return true;
      },
      checkPolicy: async () => {
        steps.push("policy");
        return true;
      },
      invoke: async () => {
        steps.push("invoke");
        return kit.text("closed");
      },
    });

    expect(result).toEqual({ content: [{ type: "text", text: "closed" }] });
    expect(steps).toEqual(["resolve", "context", "grant:deal-1", "policy", "invoke"]);
  });

  it("stops before invocation when a grant is missing", async () => {
    let invoked = false;
    const result = await dispatch(envelope(), {
      resolve: async () => ({ target }),
      checkGrant: async () => ({ allowed: false, reason: "Forbidden: missing editor" }),
      invoke: async () => {
        invoked = true;
        return kit.text("should not run");
      },
    });

    expect(result.errorCode).toBe("missing_grant");
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("Forbidden: missing editor");
    expect(invoked).toBe(false);
  });

  it("normalizes validation and provider failures", async () => {
    const invalid = await dispatch(envelope({}), {
      resolve: async () => ({ target }),
      invoke: async () => kit.text("unreachable"),
    });
    expect(invalid.errorCode).toBe("invalid_arguments");

    const failed = await dispatch(envelope(), {
      resolve: async () => ({ target }),
      invoke: async () => {
        throw new Error("provider unavailable");
      },
    });
    expect(failed.errorCode).toBe("provider_failure");
    expect((failed.content[0] as { text: string }).text).toContain("provider unavailable");
  });

  it("records dispatch denials in the hash chain without exposing arguments or results", async () => {
    const store = new HashChainedAuditStore({ createId: () => "dispatch-audit-1" });
    const auditEvents: unknown[] = [];
    const result = await dispatch(
      envelope({ dealId: "secret-deal", notes: "never persist" }),
      {
        resolve: async () => ({ target }),
        checkGrant: async () => ({ allowed: false, reason: "Forbidden" }),
        invoke: async () => kit.text("private result"),
        audit: async (event) => { auditEvents.push(event); },
      },
    );
    expect(result.errorCode).toBe("missing_grant");
    expect(auditEvents[0]).not.toHaveProperty("args");
    expect(auditEvents[0]).not.toHaveProperty("result");

    const storeSink = createDispatchAuditSink(store, { orgId: "org-demo", appId: "app-demo" });
    await dispatch(envelope({ dealId: "secret-deal", notes: "never persist" }), {
      resolve: async () => ({ target }),
      checkGrant: async () => ({ allowed: false, reason: "Forbidden" }),
      invoke: async () => kit.text("private result"),
      audit: storeSink,
    });

    const records = await store.query({ outcome: "denied" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      action: "dispatch.close_deal",
      outcome: "denied",
      errorCode: "missing_grant",
      orgId: "org-demo",
      appId: "app-demo",
    });
    const exported = await store.export("json");
    expect(exported).not.toContain("secret-deal");
    expect(exported).not.toContain("never persist");
    expect(exported).not.toContain("private result");
    expect((await store.verify()).valid).toBe(true);
  });
});
