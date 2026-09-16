import { appendFile } from "node:fs/promises";
import { adintEvaluation } from "../kits/adint/src/evals/golden.js";
import { presenterEvaluation } from "../kits/debrief/src/evals/presenter.js";
import type { EvalReport } from "../packages/sdk/src/eval.js";

const promote = process.argv.includes("--promote");

function kpiTable(report: EvalReport): string {
  const baseline = report.scenarios.map((scenario) => scenario.baseline);
  const kit = report.scenarios.map((scenario) => scenario.kit);
  const voiceTurnTokens = (measurements: typeof kit) => measurements
    .map((measurement) => Number(measurement.metadata?.voiceTurnTokens))
    .filter(Number.isFinite);
  const average = (values: readonly number[]): string => values.length === 0
    ? "n/a"
    : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const baselineVoice = average(voiceTurnTokens(baseline));
  const kitVoice = average(voiceTurnTokens(kit));
  const voiceDelta = baselineVoice === "n/a" || kitVoice === "n/a"
    ? "n/a"
    : (Number(kitVoice) - Number(baselineVoice)).toFixed(1);
  return [
    "",
    "| KPI baseline | CRUD baseline | Kit | Δ |",
    "|---|---:|---:|---:|",
    `| Result tokens per evaluated workflow | ${average(baseline.map((measurement) => measurement.resultTokens ?? 0))} | ${average(kit.map((measurement) => measurement.resultTokens ?? 0))} | ${report.summary.kitResultTokens - report.summary.baselineResultTokens} |`,
    `| Tokens per voice turn (debrief fixture) | ${baselineVoice} | ${kitVoice} | ${voiceDelta} |`,
    `| Tool latency p50 / p95 (ms) | ${report.summary.baselineP50ToolLatencyMs ?? "n/a"} / ${report.summary.baselineP95ToolLatencyMs ?? "n/a"} | ${report.summary.kitP50ToolLatencyMs ?? "n/a"} / ${report.summary.kitP95ToolLatencyMs ?? "n/a"} | — |`,
    "",
  ].join("\n");
}

async function run(): Promise<void> {
  const reports = [await presenterEvaluation.run(), await adintEvaluation.run()];
  if (promote) {
    for (const report of reports) {
      const evaluation = report.evalId === presenterEvaluation.id ? presenterEvaluation : adintEvaluation;
      evaluation.assertPromotion(report);
    }
  }
  const markdown = reports.map((report) => {
    const evaluation = report.evalId === presenterEvaluation.id ? presenterEvaluation : adintEvaluation;
    return [`## ${report.evalId}`, "", evaluation.formatTable(report), kpiTable(report)].join("\n");
  }).join("\n");
  console.log(markdown);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) await appendFile(summaryPath, `${markdown}\n`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
