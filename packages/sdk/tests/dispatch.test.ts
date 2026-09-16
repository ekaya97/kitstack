import { describe, expect, it } from "vitest";
import {
  createDispatchEnvelope,
  dispatch,
  type DispatchTarget,
} from "../src/server/dispatch";
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
});
