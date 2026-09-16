import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { authenticatedCliClient, jsonBody, type CliApiClient } from "../api-client";

const HELP = `
kitstack connectors bind — bind an org connector without handling secret values

Usage:
  kitstack connectors bind <connector-id> --config <json> --secret-ref <name=reference> [options]

Options:
  --config <json>          Connector configuration JSON
  --config-file <path>     Read connector configuration JSON from a file
  --secret-ref <name=ref>  Host secret reference (repeatable)
  --yes                    Confirm the binding
  --json                   Print JSON
  --help, -h               Show help
`.trim();

export interface ConnectorBindOptions {
  readonly connectorId: string;
  readonly config: Record<string, unknown>;
  readonly secretRefs: Record<string, string>;
  readonly confirmed: boolean;
  readonly json: boolean;
}

export function parseConnectorBindArgs(args: string[]): ConnectorBindOptions {
  let connectorId: string | undefined;
  let configText: string | undefined;
  let configFile: string | undefined;
  const secretRefs: Record<string, string> = {};
  let confirmed = false;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--config" && args[index + 1]) configText = args[++index];
    else if (arg === "--config-file" && args[index + 1]) configFile = resolve(args[++index]);
    else if (arg === "--secret-ref" && args[index + 1]) {
      const pair = args[++index];
      const separator = pair.indexOf("=");
      if (separator < 1 || separator === pair.length - 1) throw new Error("--secret-ref must be name=reference");
      secretRefs[pair.slice(0, separator)] = pair.slice(separator + 1);
    } else if (arg === "--yes") confirmed = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown connectors option: ${arg}`);
    else if (!connectorId) connectorId = arg;
    else throw new Error(`Unexpected connector argument: ${arg}`);
  }
  if (!connectorId) throw new Error("Connector id is required");
  if (configText && configFile) throw new Error("Use either --config or --config-file, not both");
  const raw = configText ?? (configFile && readFileSync(configFile, "utf8")) ?? "{}";
  let config: Record<string, unknown>;
  try { config = JSON.parse(raw); } catch { throw new Error("Connector config must be valid JSON"); }
  if (!config || Array.isArray(config) || typeof config !== "object") throw new Error("Connector config must be a JSON object");
  assertNoSecretValues(config);
  return { connectorId, config, secretRefs, confirmed, json };
}

export async function bindConnectorCommand(args: string[], client?: CliApiClient): Promise<unknown> {
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return null; }
  client ??= authenticatedCliClient();
  const options = parseConnectorBindArgs(args);
  if (!options.confirmed) throw new Error("Connector binding changes org configuration. Re-run with --yes to confirm.");
  const result = await client.request("/api/cli/connectors/bind", {
    method: "POST",
    body: jsonBody({ connectorId: options.connectorId, config: options.config, secretRefs: options.secretRefs }),
  });
  console.log(options.json ? JSON.stringify(result, null, 2) : JSON.stringify(result));
  return result;
}

function assertNoSecretValues(config: Record<string, unknown>): void {
  const suspicious = /(api[-_]?key|token|secret|password|private[-_]?key|credential)/i;
  for (const [key, value] of Object.entries(config)) {
    if (suspicious.test(key) && typeof value === "string" && value.trim()) {
      throw new Error(`Connector config contains a secret-shaped value at "${key}". Pass it with --secret-ref instead.`);
    }
  }
}
