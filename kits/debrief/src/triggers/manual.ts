import type { DebriefTrigger } from "./index";

export interface ManualDebriefPayload {
  readonly goal: string;
  readonly sessionId?: string;
}

export function createManualTrigger(
  verify: DebriefTrigger<ManualDebriefPayload>["verify"] = async () => true,
): DebriefTrigger<ManualDebriefPayload> {
  return {
    id: "trigger:manual",
    identity: "manual-debrief",
    verify,
    normalize: (payload) => ({
      type: "debrief.requested",
      source: "manual",
      payload,
    }),
  };
}
