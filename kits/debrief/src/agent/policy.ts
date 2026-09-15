import { DEBRIEF_KIT_ID } from "../contracts";

export type DebriefState =
  | "prepared"
  | "calling"
  | "awaiting_confirmation"
  | "partial"
  | "confirmed"
  | "failed";

export interface DebriefSession {
  readonly sessionId: string;
  readonly orgId: string;
  readonly kitId: string;
  readonly state: DebriefState;
  readonly goal: string;
  readonly instructionVersion: string;
  readonly memoryIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly error?: string;
}

const transitions: Readonly<Record<DebriefState, readonly DebriefState[]>> = {
  prepared: ["calling"],
  calling: ["awaiting_confirmation", "failed"],
  awaiting_confirmation: ["partial", "confirmed", "failed"],
  partial: ["confirmed", "failed"],
  confirmed: [],
  failed: [],
};

export function canTransition(from: DebriefState, to: DebriefState): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: DebriefState, to: DebriefState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid debrief transition ${from} -> ${to}`);
  }
}

export function createDebriefSession(input: {
  sessionId: string;
  orgId: string;
  goal: string;
  instructionVersion: string;
  memoryIds?: readonly string[];
  now?: string;
  kitId?: string;
}): DebriefSession {
  const now = input.now ?? new Date().toISOString();
  return {
    sessionId: input.sessionId,
    orgId: input.orgId,
    kitId: input.kitId ?? DEBRIEF_KIT_ID,
    state: "prepared",
    goal: input.goal,
    instructionVersion: input.instructionVersion,
    memoryIds: [...(input.memoryIds ?? [])],
    createdAt: now,
    updatedAt: now,
  };
}
