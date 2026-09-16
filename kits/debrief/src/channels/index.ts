import type { ChannelDefinition } from "@kitstackco/sdk";

export interface DebriefChannel<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly kind: ChannelDefinition["kind"];
  open(sessionId: string): Promise<void>;
  receive(input: TInput): Promise<void>;
  send(output: TOutput): Promise<void>;
  close(): Promise<void>;
}

export const VOICE_CHANNEL_ID = "channel:voice" as const;
export const MCP_CHANNEL_ID = "channel:mcp" as const;

export * from "./voice";
