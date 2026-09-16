import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { DemoPlugin, DemoPluginContext } from "../plugins/registry/index.js";
import { DEBRIEF_KIT_ID } from "../contracts";

export const INSTRUCTION_PLUGIN_ID = "instructions:debrief-baseline";
export const DEFAULT_INSTRUCTION_CONTEXT = "default";
export const DEFAULT_DEBRIEF_INSTRUCTION_FILE = new URL(
  "./debrief-baseline.md",
  import.meta.url,
).pathname;

export interface InstructionContext {
  /** Exact, caller-selected context such as `prebrief` or `voice`. */
  readonly name?: string;
  /** Optional exact locale selector for a future multi-locale manifest. */
  readonly locale?: string;
}

export interface InstructionManifestEntry {
  readonly id: string;
  readonly kitId: string;
  readonly context?: string;
  readonly locale?: string;
  /** Inline content is allowed for tests and an injected runtime manifest. */
  readonly content?: string;
  /** A manifest entry may instead point at a local instruction file. */
  readonly filePath?: string;
  /** Explicit versions are trusted manifest metadata; otherwise hash-derived. */
  readonly version?: string;
  readonly source?: string;
}

export interface InstructionManifest {
  readonly entries: readonly InstructionManifestEntry[];
}

export interface InstructionPluginOptions {
  /** Use exactly one source: `filePath` or `manifest`. */
  readonly filePath?: string;
  readonly manifest?: InstructionManifest;
  readonly id?: string;
  readonly kitId?: string;
  readonly context?: string;
  readonly version?: string;
}

export interface InstructionRequest {
  readonly kitId: string;
  readonly context?: InstructionContext;
}

export interface ResolvedInstruction {
  readonly id: string;
  readonly kitId: string;
  readonly context: string;
  readonly locale: string | null;
  readonly content: string;
  readonly version: string;
  readonly hash: string;
  readonly source: string;
}

export interface InstructionPlugin
  extends DemoPlugin<InstructionRequest, ResolvedInstruction> {
  readonly resolve: (
    request: InstructionRequest,
    context: DemoPluginContext,
  ) => Promise<ResolvedInstruction>;
}

export class InstructionManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstructionManifestError";
  }
}

export class InstructionKitNotFoundError extends InstructionManifestError {
  constructor(kitId: string) {
    super(`No instructions are registered for kit "${kitId}"`);
    this.name = "InstructionKitNotFoundError";
  }
}

export class InstructionResolutionError extends InstructionManifestError {
  constructor(message: string) {
    super(message);
    this.name = "InstructionResolutionError";
  }
}

/**
 * Build the baseline instruction plugin from a file or an already loaded
 * manifest. Sources are read once at construction, giving one deterministic
 * version/hash for the lifetime of a demo process.
 */
export function createInstructionPlugin(
  options: InstructionPluginOptions = {},
): InstructionPlugin {
  const manifest = normalizeManifest(options);
  const entries = materializeEntries(manifest);
  validateEntries(entries);

  const resolveInstruction = async (
    request: InstructionRequest,
    context: DemoPluginContext,
  ): Promise<ResolvedInstruction> => {
    const resolved = resolveManifestEntry(entries, request);
    await context.telemetry.append({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      orgId: context.orgId,
      appId: context.appId,
      sessionId: context.sessionId,
      parentId: context.parentId,
      traceId: context.traceId,
      channel: "system",
      pluginId: INSTRUCTION_PLUGIN_ID,
      kitId: resolved.kitId,
      type: "instruction.served",
      operation: "resolve",
      instructionVersions: [resolved.version],
      outcome: "success",
    });
    return resolved;
  };

  return {
    id: INSTRUCTION_PLUGIN_ID,
    kind: "instructions",
    version: "0.1.0",
    invoke: resolveInstruction,
    resolve: resolveInstruction,
  };
}

/** Read a raw instruction file into the same injectable manifest shape. */
export function loadInstructionManifestFromFile(
  filePath: string,
  options: Omit<InstructionPluginOptions, "filePath" | "manifest"> = {},
): InstructionManifest {
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  return {
    entries: [{
      id: options.id ?? INSTRUCTION_PLUGIN_ID,
      kitId: options.kitId ?? DEBRIEF_KIT_ID,
      context: options.context ?? DEFAULT_INSTRUCTION_CONTEXT,
      content: readFileSync(absolutePath, "utf8"),
      version: options.version,
      source: absolutePath,
    }],
  };
}

function normalizeManifest(options: InstructionPluginOptions): InstructionManifest {
  if (options.filePath && options.manifest) {
    throw new InstructionManifestError("Provide either filePath or manifest, not both");
  }
  if (options.manifest) {
    return options.manifest;
  }
  return loadInstructionManifestFromFile(
    options.filePath ?? DEFAULT_DEBRIEF_INSTRUCTION_FILE,
    options,
  );
}

interface MaterializedEntry {
  readonly id: string;
  readonly kitId: string;
  readonly context: string;
  readonly locale: string | null;
  readonly content: string;
  readonly version: string;
  readonly hash: string;
  readonly source: string;
}

function materializeEntries(manifest: InstructionManifest): MaterializedEntry[] {
  return manifest.entries.map((entry) => {
    const content = entry.content ?? (entry.filePath ? readFileSync(
      isAbsolute(entry.filePath) ? entry.filePath : resolve(process.cwd(), entry.filePath),
      "utf8",
    ) : undefined);
    if (content === undefined) {
      throw new InstructionManifestError(
        `Instruction "${entry.id}" must provide content or filePath`,
      );
    }
    const hash = hashContent(content);
    return {
      id: entry.id,
      kitId: entry.kitId,
      context: entry.context ?? DEFAULT_INSTRUCTION_CONTEXT,
      locale: entry.locale ?? null,
      content,
      version: entry.version ?? `sha256:${hash}`,
      hash,
      source: entry.source ?? entry.filePath ?? "injected-manifest",
    };
  });
}

function validateEntries(entries: readonly MaterializedEntry[]): void {
  if (entries.length === 0) {
    throw new InstructionManifestError("Instruction manifest must contain at least one entry");
  }
  const keys = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || !entry.kitId || !entry.content) {
      throw new InstructionManifestError("Instruction entries require id, kitId, and content");
    }
    const key = `${entry.kitId}\u0000${entry.context}\u0000${entry.locale ?? ""}`;
    if (keys.has(key)) {
      throw new InstructionManifestError(`Duplicate instruction context for kit "${entry.kitId}"`);
    }
    keys.add(key);
  }
}

function resolveManifestEntry(
  entries: readonly MaterializedEntry[],
  request: InstructionRequest,
): ResolvedInstruction {
  const kitEntries = entries.filter((entry) => entry.kitId === request.kitId);
  if (kitEntries.length === 0) {
    throw new InstructionKitNotFoundError(request.kitId);
  }

  const requestedContext = request.context?.name ?? DEFAULT_INSTRUCTION_CONTEXT;
  const requestedLocale = request.context?.locale ?? null;
  const matches = kitEntries.filter((entry) =>
    entry.context === requestedContext && (entry.locale === requestedLocale || entry.locale === null),
  );
  if (matches.length === 0) {
    throw new InstructionResolutionError(
      `No instructions match kit "${request.kitId}" and context "${requestedContext}"`,
    );
  }

  // Validation rejects duplicate selectors. Sorting makes resolution stable
  // if a manifest contains both locale-specific and locale-neutral entries.
  const selected = [...matches].sort((left, right) => {
    if (left.locale === requestedLocale && right.locale !== requestedLocale) return -1;
    if (left.locale !== requestedLocale && right.locale === requestedLocale) return 1;
    return left.id.localeCompare(right.id);
  })[0];
  return selected;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
