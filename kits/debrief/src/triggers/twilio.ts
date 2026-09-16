import { defineTrigger } from "@kitstackco/sdk";
import type { DebriefTrigger, DebriefTriggerEvent, DebriefTriggerVerifier } from "./index";

export interface TwilioVoicePayload {
  readonly CallSid?: string;
  readonly From?: string;
  readonly To?: string;
  readonly [key: string]: unknown;
}

export interface TwilioTriggerOptions {
  readonly verify: DebriefTriggerVerifier<TwilioVoicePayload>;
}

/**
 * Twilio is deliberately represented as a trigger boundary only. Signature
 * validation and the connector implementation stay in the host application.
 */
export function createTwilioVoiceTrigger(
  options: TwilioTriggerOptions,
): DebriefTrigger<TwilioVoicePayload> {
  const normalize = (payload: TwilioVoicePayload) => ({
    type: "voice.started" as const,
    source: "twilio.voice",
    payload,
  });
  const trigger = defineTrigger<TwilioVoicePayload, DebriefTriggerEvent<TwilioVoicePayload>>({
    id: "trigger:twilio-voice",
    kind: "webhook",
    identity: { type: "service", principal: "twilio.voice" },
    kits: ["kit:debrief"],
    channel: { kind: "voice", id: "trigger:twilio-voice" },
    verify: (request) => options.verify(request.payload, request.headers),
    handler: async (_context, payload) => normalize(payload),
  });
  return { ...trigger, normalize };
}
