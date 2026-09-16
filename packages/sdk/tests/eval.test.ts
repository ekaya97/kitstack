import { describe, expect, it } from "vitest";
import { createEval } from "../src/eval";

const measurement = (taskSuccess: boolean, toolLatencyMs: number, resultTokens: number) => ({
  taskSuccess,
  toolLatencyMs,
  resultTokens,
  roundTrips: 1,
  costUsd: resultTokens * 0.000001,
});

describe("createEval", () => {
  it("runs the same scenarios through both surfaces and reports deltas", async () => {
    const evalDefinition = createEval({
      id: "sales-golden",
      scenarios: [
        { id: "acme-prebrief", name: "Acme prebrief", input: { customer: "Acme" } },
        { id: "acme-debrief", input: { customer: "Acme", outcome: "signed" } },
      ],
      baseline: { run: async (scenario) => measurement(true, scenario.id === "acme-prebrief" ? 100 : 200, 40) },
      kit: { run: async () => measurement(true, 80, 20) },
      now: (() => { const values = ["2026-09-16T10:00:00.000Z", "2026-09-16T10:00:01.000Z"]; return () => values.shift()!; })(),
      createRunId: () => "run-1",
    });
    const report = await evalDefinition.run();
    expect(report.runId).toBe("run-1");
    expect(report.summary).toMatchObject({ scenarios: 2, baselineSuccessRate: 1, kitSuccessRate: 1, kitP50ToolLatencyMs: 80, kitP95ToolLatencyMs: 80 });
    expect(report.scenarios[0].delta).toMatchObject({ resultTokens: -20, toolLatencyMs: -20 });
    expect(evalDefinition.formatTable(report)).toContain("Acme prebrief");
    expect(() => evalDefinition.assertPromotion(report)).not.toThrow();
  });

  it("rejects duplicate scenarios and promotion regressions", async () => {
    expect(() => createEval({ id: "bad", scenarios: [{ id: "same", input: 1 }, { id: "same", input: 2 }], baseline: { run: async () => measurement(true, 1, 1) }, kit: { run: async () => measurement(true, 1, 1) } })).toThrow(/duplicate/);
    const definition = createEval({ id: "regression", scenarios: [{ id: "one", input: null }], baseline: { run: async () => measurement(true, 10, 1) }, kit: { run: async () => measurement(false, 20, 2) } });
    const report = await definition.run();
    expect(() => definition.assertPromotion(report)).toThrow(/task success regressed/);
    expect(() => definition.assertPromotion(report, { requireNoSuccessRegression: false, maxLatencyRegressionRatio: 0.1 })).toThrow(/p95 tool latency/);
  });
});
