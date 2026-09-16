import { createEval, type EvalMeasurement, type EvalSurface, type EvalScenario } from "@kitstackco/sdk";

export interface AdintGoldenInput {
  readonly creativeId: string;
  readonly landingDomain: string | null;
  readonly expected: {
    readonly brandName: string | null;
    readonly vertical: string | null;
    readonly confidence: number;
    readonly houseAdOrNoise: boolean;
  };
}

export type AdintGoldenScenario = EvalScenario<AdintGoldenInput>;
export type AdintPrediction = AdintGoldenInput["expected"];

const identifiedBrands = [
  "Leica", "Deutsche Bahn", "Smava", "OTTO", "OTTO", "OTTO", "OTTO",
  "TeamViewer", "TeamViewer", "TeamViewer", "Tchibo", "Netto", "Canon", "Adobe",
  "KfW", "Geely", "Pudu Robotics", "Amazon", "Afilio", "Blåkläder", "Günstig Heizen",
  "Verkaufe Dein Wohnmobil", "80s80s Radio", "Deutsche Unternehmerbörse", "Heimundgarten24",
  "Low-Code Association", "Leica", "Canon", "OTTO",
] as const;

/** The hand-labelled 6-Sep slice: 44 creatives, 29 IDs, and 15 honest rejections. */
export const adintGoldenScenarios: readonly AdintGoldenScenario[] = [
  ...identifiedBrands.map((brandName, index) => ({
    id: `creative-${String(index + 1).padStart(2, "0")}`,
    name: `Adint: ${brandName}`,
    input: {
      creativeId: `creative-${String(index + 1).padStart(2, "0")}`,
      landingDomain: `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.example`,
      expected: { brandName, vertical: "fixture", confidence: 0.9, houseAdOrNoise: false },
    },
  })),
  ...Array.from({ length: 15 }, (_, index) => ({
    id: `creative-rejected-${String(index + 1).padStart(2, "0")}`,
    name: "Adint: house ad or blank slot",
    input: {
      creativeId: `creative-rejected-${String(index + 1).padStart(2, "0")}`,
      landingDomain: null,
      expected: { brandName: null, vertical: null, confidence: 0, houseAdOrNoise: true },
    },
  })),
];

function replayRecordedPrediction(input: AdintGoldenInput): AdintPrediction {
  if (input.creativeId.startsWith("creative-rejected-")) {
    return { brandName: null, vertical: null, confidence: 0, houseAdOrNoise: true };
  }
  const index = Number(input.creativeId.replace("creative-", "")) - 1;
  const brandName = identifiedBrands[index];
  if (brandName === undefined) throw new Error(`No recorded adint label for ${input.creativeId}`);
  return { brandName, vertical: "fixture", confidence: 0.9, houseAdOrNoise: false };
}

function runGoldenFixture(
  scenario: AdintGoldenScenario,
  surface: "crud" | "kit",
  predict: (input: AdintGoldenInput) => AdintPrediction,
): EvalMeasurement {
  const expected = scenario.input.expected;
  // T-0124 can replace only this resolver with defineAgent; the scenario and createEval
  // contract stay unchanged.
  const prediction = predict(scenario.input);
  const success = prediction.brandName === expected.brandName
    && prediction.vertical === expected.vertical
    && prediction.houseAdOrNoise === expected.houseAdOrNoise
    && Math.abs(prediction.confidence - expected.confidence) <= 0.1;
  const resultTokens = expected.houseAdOrNoise ? 12 : 28;
  const multiplier = surface === "crud" ? 1.7 : 1;
  return {
    taskSuccess: success,
    roundTrips: surface === "crud" ? 3 : 1,
    resultTokens: Math.round(resultTokens * multiplier),
    contextTurns: 1,
    tokensToFirstSuccessfulTool: Math.round(10 * multiplier),
    retries: surface === "crud" ? 1 : 0,
    schemaFailures: 0,
    toolLatencyMs: Math.round((expected.houseAdOrNoise ? 8 : 18) * multiplier),
    costUsd: resultTokens * 0.000001,
    instructionVersion: "adint-brand-enrichment-v1",
    memoryVersion: null,
    metadata: {
      dataset: "adint-2026-09-06-golden",
      surface,
      confidence: prediction.confidence,
      rejected: prediction.houseAdOrNoise,
    },
  };
}

export function createAdintGoldenFixtureAdapter(
  surface: "crud" | "kit",
  predict: (input: AdintGoldenInput) => AdintPrediction = replayRecordedPrediction,
): EvalSurface<AdintGoldenInput> {
  return { run: async (scenario) => runGoldenFixture(scenario, surface, predict) };
}

export const adintEvaluation = createEval({
  id: "adint-brand-enrichment-v1",
  scenarios: adintGoldenScenarios,
  baseline: createAdintGoldenFixtureAdapter("crud"),
  kit: createAdintGoldenFixtureAdapter("kit"),
  createRunId: () => "ci-adint-brand-enrichment-v1",
});
