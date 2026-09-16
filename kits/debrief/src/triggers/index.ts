import type { TriggerDefinition, TriggerVerificationRequest } from "@kitstackco/sdk";

export interface DebriefTriggerEvent<TPayload = unknown> {
  readonly type: "debrief.requested" | "voice.started" | "voice.ended";
  readonly source: string;
  readonly payload: TPayload;
}

export interface DebriefTrigger<TPayload = unknown, TResult = DebriefTriggerEvent<TPayload>>
  extends TriggerDefinition<TPayload, TResult> {
  normalize(payload: TPayload): DebriefTriggerEvent<TPayload>;
}

export type DebriefTriggerVerifier<TPayload> = (
  payload: TPayload,
  headers?: Readonly<Record<string, string | undefined>>,
) => boolean | Promise<boolean>;

export function verifyDebriefTrigger<TPayload>(
  verifier: DebriefTriggerVerifier<TPayload>,
): TriggerDefinition<TPayload>['verify'] {
  return (request: TriggerVerificationRequest<TPayload>) => verifier(request.payload, request.headers);
}

export * from "./manual";
export * from "./twilio";
