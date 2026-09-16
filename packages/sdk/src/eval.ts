/**
 * Small, provider-neutral evaluation harness.
 *
 * An eval compares the same scenarios through a CRUD baseline and a kit
 * surface. The callbacks are deliberately responsible for invoking the
 * surface; the SDK only owns the result shape, aggregation, and promotion
 * gate so it can run in CI without a provider or database dependency.
 */

export interface EvalMeasurement {
  readonly roundTrips?: number;
  readonly resultTokens?: number;
  readonly contextTurns?: number;
  readonly tokensToFirstSuccessfulTool?: number | null;
  readonly retries?: number;
  readonly schemaFailures?: number;
  readonly toolLatencyMs?: number;
  readonly taskSuccess: boolean;
  readonly costUsd?: number;
  readonly instructionVersion?: string | null;
  readonly memoryVersion?: string | null;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface EvalScenario<TInput = unknown> {
  readonly id: string;
  readonly name?: string;
  readonly input: TInput;
}

export interface EvalSurface<TInput = unknown> {
  run(scenario: EvalScenario<TInput>): Promise<EvalMeasurement>;
}

export interface EvalScenarioResult {
  readonly id: string;
  readonly name: string;
  readonly baseline: EvalMeasurement;
  readonly kit: EvalMeasurement;
  readonly delta: EvalDelta;
}

export interface EvalDelta {
  readonly roundTrips: number;
  readonly resultTokens: number;
  readonly contextTurns: number;
  readonly toolLatencyMs: number;
  readonly costUsd: number;
  readonly taskSuccess: number;
}

export interface EvalReport {
  readonly evalId: string;
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly scenarios: readonly EvalScenarioResult[];
  readonly summary: {
    readonly scenarios: number;
    readonly baselineSuccessRate: number;
    readonly kitSuccessRate: number;
    readonly baselineP50ToolLatencyMs: number | null;
    readonly kitP50ToolLatencyMs: number | null;
    readonly baselineP95ToolLatencyMs: number | null;
    readonly kitP95ToolLatencyMs: number | null;
    readonly baselineResultTokens: number;
    readonly kitResultTokens: number;
    readonly baselineCostUsd: number;
    readonly kitCostUsd: number;
  };
}

export interface EvalConfig<TInput = unknown> {
  readonly id: string;
  readonly scenarios: readonly EvalScenario<TInput>[];
  readonly baseline: EvalSurface<TInput>;
  readonly kit: EvalSurface<TInput>;
  readonly now?: () => string;
  readonly createRunId?: () => string;
}

export interface EvalDefinition<TInput = unknown> {
  readonly id: string;
  run(): Promise<EvalReport>;
  formatTable(report: EvalReport): string;
  assertPromotion(report: EvalReport, options?: PromotionOptions): void;
}

export interface PromotionOptions {
  /** Require no task-success regression; defaults to true. */
  readonly requireNoSuccessRegression?: boolean;
  /** Maximum permitted p95 latency regression as a ratio; defaults to 0.1. */
  readonly maxLatencyRegressionRatio?: number;
}

const metric = (value: number | undefined): number =>
  value === undefined || !Number.isFinite(value) ? 0 : value;

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function averageSuccess(measurements: readonly EvalMeasurement[]): number {
  if (measurements.length === 0) return 0;
  return measurements.filter((measurement) => measurement.taskSuccess).length / measurements.length;
}

function sum(measurements: readonly EvalMeasurement[], selector: (measurement: EvalMeasurement) => number | undefined): number {
  return measurements.reduce((total, measurement) => total + metric(selector(measurement)), 0);
}

function delta(baseline: EvalMeasurement, kit: EvalMeasurement): EvalDelta {
  return {
    roundTrips: metric(kit.roundTrips) - metric(baseline.roundTrips),
    resultTokens: metric(kit.resultTokens) - metric(baseline.resultTokens),
    contextTurns: metric(kit.contextTurns) - metric(baseline.contextTurns),
    toolLatencyMs: metric(kit.toolLatencyMs) - metric(baseline.toolLatencyMs),
    costUsd: metric(kit.costUsd) - metric(baseline.costUsd),
    taskSuccess: Number(kit.taskSuccess) - Number(baseline.taskSuccess),
  };
}

/** Create a deterministic, CI-friendly evaluation definition. */
export function createEval<TInput = unknown>(config: EvalConfig<TInput>): EvalDefinition<TInput> {
  if (!config.id.trim()) throw new TypeError("createEval: id must be a non-empty string");
  if (config.scenarios.length === 0) throw new TypeError("createEval: at least one scenario is required");
  const ids = new Set<string>();
  for (const scenario of config.scenarios) {
    if (!scenario.id.trim()) throw new TypeError("createEval: scenario id must be a non-empty string");
    if (ids.has(scenario.id)) throw new TypeError(`createEval: duplicate scenario id "${scenario.id}"`);
    ids.add(scenario.id);
  }
  const now = config.now ?? (() => new Date().toISOString());
  const createRunId = config.createRunId ?? (() => crypto.randomUUID());

  return {
    id: config.id,
    async run(): Promise<EvalReport> {
      const startedAt = now();
      const results: EvalScenarioResult[] = [];
      for (const scenario of config.scenarios) {
        const [baseline, kit] = await Promise.all([
          config.baseline.run(scenario),
          config.kit.run(scenario),
        ]);
        results.push({
          id: scenario.id,
          name: scenario.name ?? scenario.id,
          baseline,
          kit,
          delta: delta(baseline, kit),
        });
      }
      const completedAt = now();
      const baselineMeasurements = results.map((result) => result.baseline);
      const kitMeasurements = results.map((result) => result.kit);
      return {
        evalId: config.id,
        runId: createRunId(),
        startedAt,
        completedAt,
        scenarios: results,
        summary: {
          scenarios: results.length,
          baselineSuccessRate: averageSuccess(baselineMeasurements),
          kitSuccessRate: averageSuccess(kitMeasurements),
          baselineP50ToolLatencyMs: percentile(baselineMeasurements.map((m) => m.toolLatencyMs).filter((v): v is number => v !== undefined), 50),
          kitP50ToolLatencyMs: percentile(kitMeasurements.map((m) => m.toolLatencyMs).filter((v): v is number => v !== undefined), 50),
          baselineP95ToolLatencyMs: percentile(baselineMeasurements.map((m) => m.toolLatencyMs).filter((v): v is number => v !== undefined), 95),
          kitP95ToolLatencyMs: percentile(kitMeasurements.map((m) => m.toolLatencyMs).filter((v): v is number => v !== undefined), 95),
          baselineResultTokens: sum(baselineMeasurements, (m) => m.resultTokens),
          kitResultTokens: sum(kitMeasurements, (m) => m.resultTokens),
          baselineCostUsd: sum(baselineMeasurements, (m) => m.costUsd),
          kitCostUsd: sum(kitMeasurements, (m) => m.costUsd),
        },
      };
    },
    formatTable(report: EvalReport): string {
      const lines = [
        `| Scenario | Baseline success | Kit success | Δ tokens | Δ tool p95 ms |`,
        `|---|---:|---:|---:|---:|`,
        ...report.scenarios.map((scenario) => `| ${scenario.name} | ${scenario.baseline.taskSuccess ? "pass" : "fail"} | ${scenario.kit.taskSuccess ? "pass" : "fail"} | ${scenario.delta.resultTokens} | ${scenario.delta.toolLatencyMs} |`),
        `| **Total** | ${report.summary.baselineSuccessRate.toFixed(2)} | ${report.summary.kitSuccessRate.toFixed(2)} | ${report.summary.kitResultTokens - report.summary.baselineResultTokens} | ${report.summary.kitP95ToolLatencyMs ?? "n/a"} |`,
      ];
      return lines.join("\n");
    },
    assertPromotion(report: EvalReport, options: PromotionOptions = {}): void {
      if (options.requireNoSuccessRegression !== false && report.summary.kitSuccessRate < report.summary.baselineSuccessRate) {
        throw new Error(`Eval promotion rejected: task success regressed from ${report.summary.baselineSuccessRate.toFixed(2)} to ${report.summary.kitSuccessRate.toFixed(2)}`);
      }
      const maxRatio = options.maxLatencyRegressionRatio ?? 0.1;
      const baseline = report.summary.baselineP95ToolLatencyMs;
      const kit = report.summary.kitP95ToolLatencyMs;
      if (baseline !== null && kit !== null && baseline > 0 && kit > baseline * (1 + maxRatio)) {
        throw new Error(`Eval promotion rejected: p95 tool latency ${kit}ms exceeds baseline ${baseline}ms by more than ${(maxRatio * 100).toFixed(0)}%`);
      }
    },
  };
}
