import { authenticatedCliClient, jsonBody, type CliApiClient } from "../api-client";

const RELATIONS = new Set(["kit:use", "kit:act", "kit:deploy", "kit:telemetry", "kit:admin", "platform:admin"]);
const SUBJECT_TYPES = new Set(["organization", "team", "role", "application", "user", "service", "delegated"]);

const HELP = `
kitstack grants — inspect and change authorization grants

Usage:
  kitstack grants list [--kit <kit-id>] [--json]
  kitstack grants grant <subject-id> <relation> <object-type> <object-id> [options]
  kitstack grants revoke <subject-id> <relation> <object-type> <object-id> [options]

Options:
  --subject-type <type>  Subject type (default: user)
  --yes                  Confirm a grant mutation
  --json                 Print JSON
  --help, -h             Show help
`.trim();

export interface GrantCommandOptions {
  readonly action: "list" | "grant" | "revoke";
  readonly positional: string[];
  readonly subjectType: string;
  readonly confirmed: boolean;
  readonly json: boolean;
}

export function parseGrantArgs(args: string[]): GrantCommandOptions {
  const positional: string[] = [];
  let subjectType = "user";
  let confirmed = false;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--subject-type" && args[index + 1]) subjectType = args[++index];
    else if (arg === "--yes") confirmed = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown grants option: ${arg}`);
    else positional.push(arg);
  }
  const action = positional.shift() as GrantCommandOptions["action"] | undefined;
  if (!action || !["list", "grant", "revoke"].includes(action)) throw new Error("Use grants list, grant, or revoke");
  if (!SUBJECT_TYPES.has(subjectType)) throw new Error(`Unknown subject type: ${subjectType}`);
  return { action, positional, subjectType, confirmed, json };
}

export async function runGrants(args: string[], client?: CliApiClient): Promise<unknown> {
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return null; }
  client ??= authenticatedCliClient();
  const options = parseGrantArgs(args);
  if (options.action === "list") {
    const kit = options.positional[0];
    const result = await client.request(`/api/cli/grants${kit ? `?kit=${encodeURIComponent(kit)}` : ""}`);
    print(result, options.json);
    return result;
  }
  if (options.positional.length !== 4) throw new Error(`${options.action} requires subject-id, relation, object-type, and object-id`);
  const [subjectId, relation, objectType, objectId] = options.positional;
  if (!RELATIONS.has(relation)) throw new Error(`Unknown relation: ${relation}`);
  if (!options.confirmed) throw new Error(`${options.action} changes authorization. Re-run with --yes to confirm.`);
  const body = jsonBody({ subjectId, subjectType: options.subjectType, relation, objectType, objectId });
  const result = await client.request(`/api/cli/grants`, {
    method: options.action === "grant" ? "POST" : "DELETE",
    body,
  });
  print(result, options.json);
  return result;
}

function print(value: unknown, json: boolean): void {
  console.log(json ? JSON.stringify(value, null, 2) : typeof value === "string" ? value : JSON.stringify(value));
}
