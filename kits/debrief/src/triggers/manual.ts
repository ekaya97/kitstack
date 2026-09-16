import { defineTrigger } from "@kitstackco/sdk";
import type { DebriefTrigger, DebriefTriggerEvent, DebriefTriggerVerifier } from "./index";

export interface ManualDebriefPayload {
  readonly goal: string;
  readonly sessionId?: string;
}

export function createManualTrigger(
  verify: DebriefTriggerVerifier<ManualDebriefPayload> = async () => true,
): DebriefTrigger<ManualDebriefPayload> {
  const normalize = (payload: ManualDebriefPayload) => ({
    type: "debrief.requested" as const,
    source: "manual",
    payload,
  });
  const trigger = defineTrigger<ManualDebriefPayload, DebriefTriggerEvent<ManualDebriefPayload>>({
    id: "trigger:manual",
    kind: "http",
    identity: { type: "service", principal: "manual-debrief" },
    kits: ["kit:debrief"],
    channel: { kind: "http", id: "trigger:manual" },
    verify: (request) => verify(request.payload, request.headers),
    handler: async (_context, payload) => normalize(payload),
  });
  return { ...trigger, normalize };
}

export interface ScheduledDebriefPayload {
  readonly sessionId: string;
}

/** Internal scheduler invocation of the same trigger boundary. */
export function createScheduledTrigger<TResult = DebriefTriggerEvent<ScheduledDebriefPayload>>(
  handler?: (context: Parameters<DebriefTrigger<ScheduledDebriefPayload>["handler"]>[0], payload: ScheduledDebriefPayload) => TResult | Promise<TResult>,
): DebriefTrigger<ScheduledDebriefPayload, TResult> {
  const normalize = (payload: ScheduledDebriefPayload) => ({
    type: "debrief.requested" as const,
    source: "scheduler",
    payload,
  });
  const trigger = defineTrigger<ScheduledDebriefPayload, TResult>({
    id: "trigger:scheduler",
    kind: "schedule",
    identity: { type: "service", principal: "debrief-scheduler" },
    kits: ["kit:debrief"],
    channel: { kind: "schedule", id: "trigger:scheduler" },
    handler: handler ?? (async (_context, payload) => normalize(payload) as TResult),
  });
  return { ...trigger, normalize };
}
