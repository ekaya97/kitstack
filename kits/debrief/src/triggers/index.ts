export interface DebriefTriggerEvent<TPayload = unknown> {
  readonly type: "debrief.requested" | "voice.started" | "voice.ended";
  readonly source: string;
  readonly payload: TPayload;
}

export interface DebriefTrigger<TPayload = unknown> {
  readonly id: string;
  readonly identity: string;
  verify(payload: TPayload, headers?: Readonly<Record<string, string | undefined>>): Promise<boolean>;
  normalize(payload: TPayload): DebriefTriggerEvent<TPayload>;
}

export * from "./manual";
export * from "./twilio";
