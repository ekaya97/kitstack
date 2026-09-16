import { describe, expect, it } from "vitest";
import { adintEvaluation, adintGoldenScenarios } from "./golden.js";

describe("adint golden fixture eval", () => {
  it("covers the recorded 29 identifications and 15 rejections", async () => {
    const report = await adintEvaluation.run();
    expect(adintGoldenScenarios).toHaveLength(44);
    expect(adintGoldenScenarios.filter((scenario) => scenario.input.expected.houseAdOrNoise)).toHaveLength(15);
    expect(report.summary.kitSuccessRate).toBe(1);
    expect(report.scenarios[0]?.kit.metadata).toMatchObject({ dataset: "adint-2026-09-06-golden" });
  });
});
