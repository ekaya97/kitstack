import { VOICE_CHANNEL_ID, type DebriefChannel } from "./index";

export interface VoiceMediaFrame {
  readonly encoding: string;
  readonly payload: string;
  readonly timestamp?: number;
}

export interface VoiceOutput {
  readonly text?: string;
  readonly audio?: string;
  readonly terminal?: boolean;
}

export interface VoiceChannelTransport {
  open(sessionId: string): Promise<void>;
  receive(frame: VoiceMediaFrame): Promise<void>;
  send(output: VoiceOutput): Promise<void>;
  close(): Promise<void>;
}

/** A transport-neutral voice channel adapter; Twilio remains a host connector. */
export function createVoiceChannel(
  transport: VoiceChannelTransport,
): DebriefChannel<VoiceMediaFrame, VoiceOutput> {
  return {
    id: VOICE_CHANNEL_ID,
    kind: "voice",
    open: (sessionId) => transport.open(sessionId),
    receive: (frame) => transport.receive(frame),
    send: (output) => transport.send(output),
    close: () => transport.close(),
  };
}
