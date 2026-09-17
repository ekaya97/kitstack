import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefineAgentVoiceLoop, createSignedSessionTokenCodec, type OpenAIRealtimeSocket, type VoiceWebSocket } from "../adapters/voice/realtime.js";
import { createDebriefVoiceTools } from "../adapters/voice/tools.js";
import { createDemoApp, type DemoApp } from "../composition/app/index.js";
import { attachVoiceMediaBridge, handleLiveVoiceStart, type LiveVoiceHttpOptions } from "./http/voice.js";

class FakeSocket implements VoiceWebSocket, OpenAIRealtimeSocket {
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Array<(...args: any[]) => void>>();

  send(data: string): void { this.sent.push(data); }
  close(): void {}
  on(event: string, listener: (...args: any[]) => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }
  once(event: string, listener: (...args: any[]) => void): this { return this.on(event, listener); }
  emit(event: string, ...args: any[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

let app: DemoApp | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("integrated voice persistence boundary", () => {
  it("reads the real memory store and writes call lifecycle data through the real DemoApp", async () => {
    app = await createDemoApp({ url: ":memory:", secret: "integrated-voice-test-secret-at-least-32-chars" });

    const first = await app.debrief.prepareDebrief({
      goal: "Improve the sales conversation",
      company: "Acme Corp",
      contactName: "Mr John Doe",
      location: "Köln Café",
    });
    await app.voice.start(first.sessionId);
    await app.voice.advance(first.sessionId);
    const correction = await app.debrief.teachFromCorrection(first.sessionId, "Ask for the implementation timeline before discussing price.");
    await app.debrief.approve(first.sessionId, correction.memoryId);
    await app.debrief.publish(first.sessionId, correction.memoryId);

    const prepared = await app.debrief.prepareDebrief({
      goal: "Improve the sales conversation",
      company: "Acme Corp",
      contactName: "Mr John Doe",
      location: "Köln Café",
    });
    expect(prepared.memoryIds).toContain(correction.memoryId);
    const preparedCustomerId = app.debrief.getSession(prepared.sessionId).customerId;
    if (!preparedCustomerId) throw new Error("Integrated voice fixture did not create a customer");

    const codec = createSignedSessionTokenCodec(app.apps.secret, () => 1_700_000_000_000);
    let sessionToken = "";
    const callId = "CA-integrated-voice";
    const liveVoice: LiveVoiceHttpOptions = {
      twilio: {
        createCall: vi.fn(async (request) => {
          expect(request.to).toBe("+491234567890");
          expect(request.record).toBe(false);
          expect(request.twiml).toContain("kitstack_session_token");
          return { sid: callId, status: "queued" };
        }),
      },
      telemetry: app.telemetry,
      orgId: app.orgId,
      appId: app.appId,
      mediaStreamUrl: "wss://demo.example/t/voice/media",
      fromNumber: "+491234567891",
      allowedDestinations: ["+491234567890"],
      requireConfirmation: true,
      sessionTokenFor: async (sessionId) => {
        sessionToken = await codec.sign({ sessionId, orgId: app!.orgId, appId: app!.appId });
        return sessionToken;
      },
      beforeStart: async (sessionId) => { await app!.debrief.markCalling(sessionId); },
      onProviderStart: async (sessionId, providerCallId) => { await app!.debrief.setCallId(sessionId, providerCallId); },
      onCallCompleted: async (call) => {
        await app!.debrief.recordCallCompleted({
          sessionId: call.sessionId,
          callId: call.callId,
          reason: call.reason,
          occurredAt: call.occurredAt,
        });
      },
    };

    const started = await handleLiveVoiceStart({
      method: "POST",
      path: "/t/voice/live/start",
      body: { session_id: prepared.sessionId, to: "+491234567890", confirmation: true },
    }, liveVoice);
    expect(started.status).toBe(202);
    expect(started.body).toMatchObject({ callId, status: "connecting" });

    const twilio = new FakeSocket();
    const openai = new FakeSocket();
    let instructions = "";
    const contextFor = async (sessionId: string) => {
      const session = app!.debrief.getSession(sessionId);
      const customer = session.customerId ? await app!.debrief.getCustomer(session.customerId) : null;
      const records = await app!.memory.readRelevant({
        orgId: session.orgId,
        kitId: session.kitId,
        customerId: session.customerId ?? undefined,
        limit: 20,
      }, {
        orgId: session.orgId,
        appId: app!.appId,
        sessionId,
        traceId: sessionId,
        parentId: null,
        kitId: session.kitId,
        customerId: session.customerId,
      });
      const selected = records.filter((record) => session.memoryIds.includes(record.memoryId));
      return {
        content: [
          "You are the debrief voice agent.",
          `Customer: ${customer?.company}; contact ${customer?.contactName}; location ${customer?.location}`,
          `Approved workflow feedback: ${selected.map((record) => record.correction).join(" | ")}`,
        ].join("\n"),
        version: "sha256:integrated-voice-test",
        memoryIds: selected.map((record) => record.memoryId),
      };
    };

    const bridge = attachVoiceMediaBridge({
      socket: twilio,
      verifier: codec,
      openai: {
        socketFactory: { connect: vi.fn(async () => openai) },
        url: "wss://openai.example/realtime",
        apiKey: "test-key",
        model: "gpt-realtime",
      },
      telemetry: app.telemetry,
      instructionsFor: async (binding) => {
        const context = await contextFor(binding.sessionId);
        instructions = context.content;
        return context.content;
      },
      agent: async (binding) => {
        const context = await contextFor(binding.sessionId);
        return createDefineAgentVoiceLoop({
          sessionId: binding.sessionId,
          orgId: binding.orgId,
          appId: binding.appId,
          instructions: { version: context.version, content: context.content },
          telemetry: app!.telemetry,
          provider: "twilio-openai-realtime",
          model: "gpt-realtime",
          memoryIds: context.memoryIds,
          onStop: async () => { await app!.debrief.awaitConfirmation(binding.sessionId); },
        });
      },
      onCallCompleted: liveVoice.onCallCompleted,
    });

    twilio.emit("message", JSON.stringify({
      event: "start",
      streamSid: "MZ-integrated-voice",
      start: {
        streamSid: "MZ-integrated-voice",
        callSid: callId,
        customParameters: { kitstack_session_token: sessionToken },
      },
    }));
    await expect(bridge.binding).resolves.toMatchObject({ sessionId: prepared.sessionId, callSid: callId });
    await vi.waitFor(() => expect(instructions).toContain("Acme Corp"));
    expect(instructions).toContain("Acme Corp");
    expect(instructions).toContain("Ask for the implementation timeline");

    openai.emit("message", JSON.stringify({ type: "response.created" }));
    openai.emit("message", JSON.stringify({ type: "response.done", response: { usage: { input_tokens: 12, output_tokens: 8 } } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    twilio.emit("message", JSON.stringify({ event: "stop", streamSid: "MZ-integrated-voice" }));
    await bridge.done;

    expect(app.debrief.getSession(prepared.sessionId)).toMatchObject({ state: "awaiting_confirmation", callId });
    await expect(app.debrief.getDraft(prepared.sessionId)).resolves.toMatchObject({
      fields: expect.objectContaining({ provider_call_id: callId, recording: false, retention: false }),
    });
    await expect(app.debrief.listCustomerEvents(preparedCustomerId)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "call_completed", sessionId: prepared.sessionId }),
    ]));
    const events = await app.telemetry.query({ sessionId: prepared.sessionId });
    expect(events.some((event) => event.operation === "agent.run_started" && event.memoryIds?.includes(correction.memoryId))).toBe(true);
    expect(events.some((event) => event.operation === "realtime_turn" && event.requestTokens === 12 && event.responseTokens === 8)).toBe(true);
    expect(events.some((event) => event.operation === "media_stream_stopped" && event.callId === callId)).toBe(true);
  });

  it("lets the voice agent write a provisional debrief through a provider tool call", async () => {
    app = await createDemoApp({ url: ":memory:", secret: "integrated-voice-tools-secret-at-least-32-chars" });
    const prepared = await app.debrief.prepareDebrief({
      goal: "Capture the agreed sales next step",
      company: "Acme Corp",
      contactName: "Mr John Doe",
      location: "Köln Café",
    });
    await app.debrief.markCalling(prepared.sessionId);

    const codec = createSignedSessionTokenCodec(app.apps.secret, () => 1_700_000_000_000);
    const sessionToken = await codec.sign({ sessionId: prepared.sessionId, orgId: app.orgId, appId: app.appId });
    const twilio = new FakeSocket();
    const openai = new FakeSocket();
    const voiceTools = createDebriefVoiceTools(app.debrief);
    const bridge = attachVoiceMediaBridge({
      socket: twilio,
      verifier: codec,
      openai: {
        socketFactory: { connect: vi.fn(async () => openai) },
        url: "wss://openai.example/realtime",
        apiKey: "test-key",
        model: "gpt-realtime",
        tools: voiceTools.realtime,
      },
      telemetry: app.telemetry,
      instructionsFor: async () => "Save explicit facts with update_debrief_draft.",
      agent: async (binding, provider) => createDefineAgentVoiceLoop({
        sessionId: binding.sessionId,
        orgId: binding.orgId,
        appId: binding.appId,
        instructions: { version: "sha256:voice-tools", content: "Save explicit facts." },
        telemetry: app!.telemetry,
        provider: "local-openai-realtime",
        model: "gpt-realtime",
        tools: voiceTools.agent,
        sendToolResult: provider.sendToolResult,
        onStop: async () => { await app!.debrief.awaitConfirmation(binding.sessionId); },
      }),
      onCallCompleted: async (call) => { await app!.debrief.recordCallCompleted(call); },
    });

    twilio.emit("message", JSON.stringify({
      event: "start",
      streamSid: "local-tool-stream",
      start: { streamSid: "local-tool-stream", callSid: "local-tool-call", customParameters: { kitstack_session_token: sessionToken } },
    }));
    await bridge.binding;
    openai.emit("message", JSON.stringify({
      type: "response.function_call_arguments.done",
      call_id: "tool-call-1",
      name: "update_debrief_draft",
      arguments: JSON.stringify({ outcome: "Proposal accepted", next_step: "Send the implementation plan" }),
    }));
    openai.emit("message", JSON.stringify({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "tool-call-1",
        name: "update_debrief_draft",
        arguments: JSON.stringify({ outcome: "Proposal accepted", next_step: "Send the implementation plan" }),
      },
    }));
    openai.emit("message", JSON.stringify({ type: "response.done", response: { usage: { input_tokens: 10, output_tokens: 6 } } }));
    await vi.waitFor(async () => expect((await app!.debrief.getDraft(prepared.sessionId))?.fields).toMatchObject({
      outcome: "Proposal accepted",
      next_step: "Send the implementation plan",
    }));
    expect(openai.sent.map((value) => JSON.parse(value))).toContainEqual(expect.objectContaining({
      type: "conversation.item.create",
      item: expect.objectContaining({ type: "function_call_output", call_id: "tool-call-1" }),
    }));

    openai.emit("message", JSON.stringify({ type: "response.done", response: { usage: { input_tokens: 4, output_tokens: 2 } } }));
    twilio.emit("message", JSON.stringify({ event: "stop", streamSid: "local-tool-stream" }));
    await bridge.done;
    await expect(app.debrief.getDebriefForConfirmation(prepared.sessionId)).resolves.toMatchObject({
      state: "awaiting_confirmation",
      draft: { fields: { outcome: "Proposal accepted", next_step: "Send the implementation plan" } },
    });
  });
});
