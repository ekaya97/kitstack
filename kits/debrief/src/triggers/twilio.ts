import type { DebriefTrigger } from "./index";

export interface TwilioVoicePayload {
  readonly CallSid?: string;
  readonly From?: string;
  readonly To?: string;
  readonly [key: string]: unknown;
}

export interface TwilioTriggerOptions {
  readonly verify: DebriefTrigger<TwilioVoicePayload>["verify"];
}

/**
 * Twilio is deliberately represented as a trigger boundary only. Signature
 * validation and the connector implementation stay in the host application.
 */
export function createTwilioVoiceTrigger(
  options: TwilioTriggerOptions,
): DebriefTrigger<TwilioVoicePayload> {
  return {
    id: "trigger:twilio-voice",
    identity: "twilio.voice",
    verify: options.verify,
    normalize: (payload) => ({
      type: "voice.started",
      source: "twilio.voice",
      payload,
    }),
  };
}
