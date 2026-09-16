import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { authenticatedCliClient, type CliApiClient } from "../api-client";

const HELP = `
kitstack add skill — install a signed, versioned skill in the repository

Usage:
  kitstack add skill <org/name>@<version> [options]

Options:
  --output <path>  Skill root (default: skills/<org>/<name>/<version>)
  --force          Replace an existing skill directory
  --json           Print JSON
  --help, -h       Show help
`.trim();

export interface SkillSpecifier { readonly org: string; readonly name: string; readonly version: string; }
export interface SkillFile { readonly path: string; readonly content?: string; readonly contentBase64?: string; readonly sha256?: string; }

export function parseSkillSpecifier(value: string): SkillSpecifier {
  const match = /^([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)@([a-z0-9][a-z0-9._-]*)$/i.exec(value);
  if (!match) throw new Error("Skill must use <org/name>@<version>");
  return { org: match[1], name: match[2], version: match[3] };
}

export function safeSkillRelativePath(path: string): string {
  if (!path || path.includes("\\") || path.startsWith("/") || path.includes("\0")) throw new Error(`Invalid skill file path: ${path}`);
  const normalized = relative(".", path);
  if (normalized === ".." || normalized.startsWith(`..${sep}`) || normalized.split(sep).includes("..")) throw new Error(`Skill file escapes install directory: ${path}`);
  return normalized;
}

export function writeSkillFiles(destination: string, files: readonly SkillFile[], force = false): string[] {
  if (existsSync(destination) && !force) throw new Error(`Skill already exists at ${destination}. Use --force to replace it.`);
  const written: string[] = [];
  for (const file of files) {
    const relativePath = safeSkillRelativePath(file.path);
    const target = resolve(destination, relativePath);
    const content = file.contentBase64 ? Buffer.from(file.contentBase64, "base64") : Buffer.from(file.content ?? "", "utf8");
    if (file.sha256 && createHash("sha256").update(content).digest("hex") !== file.sha256) throw new Error(`Checksum mismatch for skill file ${file.path}`);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, content, { flag: force ? "w" : "wx" });
    written.push(relativePath);
  }
  return written;
}

export async function addSkill(args: string[], client?: CliApiClient): Promise<unknown> {
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return null; }
  client ??= authenticatedCliClient();
  let specifier: string | undefined;
  let output: string | undefined;
  let force = false;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--output" && args[index + 1]) output = resolve(args[++index]);
    else if (arg === "--force") force = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown add skill option: ${arg}`);
    else if (!specifier) specifier = arg;
    else throw new Error(`Unexpected skill argument: ${arg}`);
  }
  if (!specifier) throw new Error("Skill specifier is required");
  const spec = parseSkillSpecifier(specifier);
  const destination = output ?? resolve(process.cwd(), "skills", spec.org, spec.name, spec.version);
  const response = await client.request<{ files: SkillFile[]; signature?: string; digest?: string }>(
    `/api/cli/skills/${encodeURIComponent(spec.org)}/${encodeURIComponent(spec.name)}/${encodeURIComponent(spec.version)}`,
  );
  if (!Array.isArray(response.files) || response.files.length === 0) throw new Error("Skill response did not contain files");
  const written = writeSkillFiles(destination, response.files, force);
  const result = { ...spec, destination, files: written, digest: response.digest ?? null, signature: response.signature ?? null };
  console.log(json ? JSON.stringify(result, null, 2) : `Installed ${specifier} (${written.length} files) in ${destination}`);
  return result;
}
