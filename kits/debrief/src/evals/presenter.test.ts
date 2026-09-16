import { describe, expect, it } from "vitest";
import { presenterEvaluation, presenterGoldenScenarios } from "./presenter.js";

describe("debrief presenter golden eval", () => {
  it("keeps the fake-clock schedule boundary and two-run memory replay", async () => {
    const report = await presenterEvaluation.run();
    expect(presenterGoldenScenarios).toHaveLength(2);
    expect(report.summary.kitSuccessRate).toBe(1);
    expect(report.scenarios[0]?.kit.memoryVersion).toBe("memory-fixture-v1");
    expect(report.scenarios[0]?.kit.metadata).toMatchObject({ dataset: "debrief-presenter-v1", surface: "kit" });
    expect(presenterEvaluation.formatTable(report)).toContain("Presenter: schedule, call, teach, replay");
  });
});
