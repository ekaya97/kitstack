import { describe, expect, it, vi } from "vitest";
import { createDeclarativeModelRouter } from "../src/model-routing";

describe("declarative model router", () => {
  it("selects the task-class model and emits its reason", async () => {
    const append = vi.fn(async () => ({}) as any);
    const router = createDeclarativeModelRouter({
      policy: { models: { conversation: "fast-model", extraction: "strong-model" } },
      telemetry: { append },
      createId: () => "route-1",
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(router.resolve("extraction", { orgId: "org-demo", kitId: "kit:debrief" })).resolves.toEqual({
      taskClass: "extraction",
      model: "strong-model",
      reason: "declarative-task-class",
    });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      id: "route-1",
      type: "model.route",
      model: "strong-model",
      routingReason: "declarative-task-class",
    }));
  });

  it("uses an explicit cold-start fallback for unknown task classes", async () => {
    const append = vi.fn(async () => ({}) as any);
    const router = createDeclarativeModelRouter({
      policy: { models: { conversation: "fast-model" }, fallback: "safe-model" },
      telemetry: { append },
    });

    await expect(router.resolve("new-task", { orgId: "org-demo" })).resolves.toMatchObject({
      model: "safe-model",
      reason: "declarative-fallback",
    });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ routingReason: "declarative-fallback" }));
  });

  it("rejects an empty policy", () => {
    expect(() => createDeclarativeModelRouter({ policy: { models: {} } })).toThrow(/at least one model/);
  });
});
