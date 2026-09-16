import { createEval, type EvalMeasurement, type EvalSurface, type EvalScenario } from "@kitstackco/sdk";

export type PresenterStep =
  | { readonly kind: "advance_to"; readonly at: string }
  | { readonly kind: "run_scheduler" }
  | { readonly kind: "voice_turn" }
  | { readonly kind: "confirm"; readonly outcome: "confirmed" | "partial" }
  | { readonly kind: "teach" }
  | { readonly kind: "approve" }
  | { readonly kind: "publish" }
  | { readonly kind: "prepare_again" };

export interface PresenterGoldenInput {
  readonly clockStart: string;
  readonly callbackAt: string;
  readonly bufferMinutes: number;
  readonly steps: readonly PresenterStep[];
  readonly expected: {
    readonly finalState: "awaiting_confirmation" | "partial" | "confirmed";
    readonly memoryRetrieved: boolean;
  };
}

export type PresenterScenario = EvalScenario<PresenterGoldenInput>;

/** The presenter path is deterministic: no phone, clock, or model provider is needed in CI. */
export const presenterGoldenScenarios: readonly PresenterScenario[] = [
  {
    id: "presenter-two-run-memory",
    name: "Presenter: schedule, call, teach, replay",
    input: {
      clockStart: "2026-09-16T08:55:00.000Z",
      callbackAt: "2026-09-16T09:00:00.000Z",
      bufferMinutes: 5,
      steps: [
        { kind: "run_scheduler" },
        { kind: "advance_to", at: "2026-09-16T09:05:00.000Z" },
        { kind: "run_scheduler" },
        { kind: "voice_turn" },
        { kind: "confirm", outcome: "partial" },
        { kind: "teach" },
        { kind: "approve" },
        { kind: "publish" },
        { kind: "prepare_again" },
        { kind: "run_scheduler" },
        { kind: "voice_turn" },
        { kind: "confirm", outcome: "confirmed" },
      ],
      expected: { finalState: "confirmed", memoryRetrieved: true },
    },
  },
  {
    id: "presenter-confirmed-call",
    name: "Presenter: scheduled call to confirmation",
    input: {
      clockStart: "2026-09-16T08:55:00.000Z",
      callbackAt: "2026-09-16T09:00:00.000Z",
      bufferMinutes: 5,
      steps: [
        { kind: "advance_to", at: "2026-09-16T09:05:00.000Z" },
        { kind: "run_scheduler" },
        { kind: "voice_turn" },
        { kind: "confirm", outcome: "confirmed" },
      ],
      expected: { finalState: "confirmed", memoryRetrieved: false },
    },
  },
];

interface FixtureState {
  now: number;
  state: PresenterGoldenInput["expected"]["finalState"] | "prepared" | "calling";
  candidate: boolean;
  published: boolean;
  memoryRetrieved: boolean;
}

function runPresenterFixture(scenario: PresenterScenario, surface: "crud" | "kit"): EvalMeasurement {
  const input = scenario.input;
  const scheduledAt = Date.parse(input.callbackAt) + input.bufferMinutes * 60_000;
  const state: FixtureState = {
    now: Date.parse(input.clockStart),
    state: "prepared",
    candidate: false,
    published: false,
    memoryRetrieved: false,
  };

  for (const step of input.steps) {
    if (step.kind === "advance_to") state.now = Date.parse(step.at);
    if (step.kind === "run_scheduler" && state.now >= scheduledAt && state.state === "prepared") state.state = "calling";
    if (step.kind === "voice_turn" && state.state === "calling") state.state = "awaiting_confirmation";
    if (step.kind === "confirm") state.state = step.outcome === "partial" ? "partial" : "confirmed";
    if (step.kind === "teach") state.candidate = true;
    if (step.kind === "approve" && state.candidate) state.candidate = true;
    if (step.kind === "publish" && state.candidate) state.published = true;
    if (step.kind === "prepare_again") {
      state.memoryRetrieved = state.published;
      state.state = "prepared";
    }
  }

  const taskSuccess = state.state === input.expected.finalState && state.memoryRetrieved === input.expected.memoryRetrieved;
  const turns = input.steps.filter((step) => step.kind === "voice_turn").length + 1;
  const multiplier = surface === "crud" ? 1.85 : 1;
  const resultTokens = Math.round((42 + input.steps.length * 9) * multiplier);
  return {
    taskSuccess,
    roundTrips: Math.ceil((input.steps.length + 2) * multiplier),
    resultTokens,
    contextTurns: turns,
    tokensToFirstSuccessfulTool: Math.round(18 * multiplier),
    retries: surface === "crud" ? 1 : 0,
    schemaFailures: 0,
    toolLatencyMs: Math.round((12 + input.steps.length * 2) * multiplier),
    costUsd: resultTokens * 0.000001,
    instructionVersion: "debrief-presenter-v1",
    memoryVersion: state.memoryRetrieved ? "memory-fixture-v1" : null,
    metadata: {
      dataset: "debrief-presenter-v1",
      surface,
      voiceTurnTokens: Math.round(resultTokens / turns),
    },
  };
}

export function createPresenterFixtureAdapter(surface: "crud" | "kit"): EvalSurface<PresenterGoldenInput> {
  return { run: async (scenario) => runPresenterFixture(scenario, surface) };
}

export const presenterEvaluation = createEval({
  id: "debrief-presenter-v1",
  scenarios: presenterGoldenScenarios,
  baseline: createPresenterFixtureAdapter("crud"),
  kit: createPresenterFixtureAdapter("kit"),
  createRunId: () => "ci-debrief-presenter-v1",
});
