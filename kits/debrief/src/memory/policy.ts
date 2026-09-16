import type {
  DebriefMemoryPlugin,
  DebriefMemoryQuery,
  DebriefMemoryRecord,
  DebriefScope,
} from "../contracts";

export const DEBRIEF_MEMORY_SKILL = "debrief" as const;

export function createMemoryQuery(
  scope: DebriefScope,
  options: Pick<DebriefMemoryQuery, "limit" | "text"> = {},
): DebriefMemoryQuery {
  return {
    ...scope,
    skill: DEBRIEF_MEMORY_SKILL,
    limit: options.limit ?? 20,
    ...(options.text === undefined ? {} : { text: options.text }),
  };
}

export function isPublishedMemory(record: DebriefMemoryRecord): boolean {
  return record.status === "published";
}

export function createMemoryPolicy(memory: DebriefMemoryPlugin) {
  return {
    retrieve: (scope: DebriefScope, text?: string) =>
      memory.readRelevant(createMemoryQuery(scope, { text })),
    teach: (correction: string, scope: DebriefScope) =>
      memory.writeCandidate({ correction, skill: DEBRIEF_MEMORY_SKILL }, scope),
  };
}
