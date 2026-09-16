import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EvalDefinition, EvalReport } from "../../eval";

const EVAL_HELP = `
kitstack eval — run a kit evaluation

Usage:
  kitstack eval [options]

Options:
  --config <path>  Eval module or kit directory (default: .)
  --json           Print the complete report as JSON
  --promote        Apply the eval promotion gate
  --help, -h       Show help
`.trim();

const CANDIDATES = ["eval.config.ts", "evals.ts", "eval.ts", "eval.config.js", "evals.js", "eval.js"];

export function parseEvalArgs(args: string[]): { configRoot: string; json: boolean; promote: boolean } {
  let configRoot = process.cwd();
  let json = false;
  let promote = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--config" && args[index + 1]) configRoot = resolve(args[++index]);
    else if (arg === "--json") json = true;
    else if (arg === "--promote") promote = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown eval option: ${arg}`);
  }
  return { configRoot, json, promote };
}

export function resolveEvalModule(configRoot: string): string {
  if (existsSync(configRoot) && statSync(configRoot).isFile()) return configRoot;
  for (const candidate of CANDIDATES) {
    const path = resolve(configRoot, candidate);
    if (existsSync(path)) return path;
  }
  throw new Error(`No eval module found in ${configRoot}. Add eval.config.ts or pass --config <path>.`);
}

export async function loadEvalDefinition(configRoot: string): Promise<EvalDefinition<any>> {
  const modulePath = resolveEvalModule(configRoot);
  const module = await import(pathToFileURL(modulePath).href);
  const candidates = [module.default, module.evaluation, module.eval, ...Object.values(module)];
  const definition = candidates.find((value): value is EvalDefinition<any> =>
    value && typeof value.run === "function" && typeof value.formatTable === "function" && typeof value.assertPromotion === "function",
  );
  if (!definition) throw new Error(`${modulePath} must export an EvalDefinition from createEval()`);
  return definition;
}

export async function runEval(args: string[]): Promise<EvalReport | null> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(EVAL_HELP);
    return null;
  }
  const options = parseEvalArgs(args);
  const definition = await loadEvalDefinition(options.configRoot);
  const report = await definition.run();
  if (options.promote) definition.assertPromotion(report);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else console.log(definition.formatTable(report));
  return report;
}
