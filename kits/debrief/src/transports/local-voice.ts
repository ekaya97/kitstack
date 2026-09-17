import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import type { DemoApp } from "../composition/app/index.js";
import type { DemoLocalVoiceRoute } from "./http/app.js";
import { attachVoiceMediaBridge } from "./http/voice.js";
import {
  createDefineAgentVoiceLoop,
  createOpenAIRealtimeSocketFactory,
  createSignedSessionTokenCodec,
  type SessionBinding,
  type VoiceWebSocket,
} from "../adapters/voice/realtime.js";
import { createDebriefVoiceTools, DEBRIEF_VOICE_REALTIME_TOOLS } from "../adapters/voice/tools.js";

/**
 * Local microphone transport for testing the real voice agent without a
 * telephony provider. The browser emits the same start/media/stop envelope as
 * Twilio, using G.711 μ-law at 8 kHz, so defineAgent and persistence exercise
 * the same path as the deployed call.
 */
export async function composeLocalVoiceRoute(app: DemoApp): Promise<DemoLocalVoiceRoute | undefined> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return undefined;

  const instructionsContent = readFileSync(new URL("../instructions/debrief-baseline.md", import.meta.url), "utf8");
  const baseInstructionsVersion = `sha256:${createHash("sha256").update(instructionsContent, "utf8").digest("hex")}`;
  const modelRoute = await app.modelRouter.resolve("conversation", {
    orgId: app.orgId,
    appId: app.appId,
    kitId: "kit:debrief",
    pluginId: "channel:voice",
  });
  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";
  const voiceTools = createDebriefVoiceTools(app.debrief);
  const tokenCodec = createSignedSessionTokenCodec(app.apps.secret);
  const openai = {
    socketFactory: createOpenAIRealtimeSocketFactory(),
    url: process.env.OPENAI_REALTIME_URL?.trim() || "wss://api.openai.com/v1/realtime",
    apiKey,
    model,
    instructions: instructionsContent,
    voice: process.env.OPENAI_REALTIME_VOICE?.trim() || "marin",
    tools: DEBRIEF_VOICE_REALTIME_TOOLS,
  };

  const voiceContextFor = async (binding: SessionBinding) => {
    const session = app.debrief.getSession(binding.sessionId);
    const customer = session.customerId ? await app.debrief.getCustomer(session.customerId) : null;
    const records = await app.memory.readRelevant({
      orgId: session.orgId,
      kitId: session.kitId,
      ...(session.customerId ? { customerId: session.customerId } : {}),
      limit: 20,
    }, {
      orgId: session.orgId,
      appId: binding.appId,
      sessionId: session.sessionId,
      traceId: session.sessionId,
      parentId: null,
      kitId: session.kitId,
      customerId: session.customerId,
    });
    const selected = records.filter((record) => session.memoryIds.includes(record.memoryId));
    const content = [
      instructionsContent.trim(),
      "\nPrepared debrief context:",
      `Goal: ${session.goal}`,
      customer ? `Customer: ${customer.company}; contact ${customer.contactName}; location ${customer.location}` : "Customer: unavailable.",
      selected.length ? `Approved workflow feedback:\n${selected.map((record) => `- ${record.correction}`).join("\n")}` : "Approved workflow feedback: none.",
      "Use this context during the call. Ask one useful question at a time and do not invent customer details.",
      "When the caller explicitly states or agrees an outcome, next step, customer update, address, or follow-up date, call update_debrief_draft with those facts. Never call a confirmation or publish action; the operator confirms the draft after the call.",
    ].join("\n");
    return {
      content,
      version: `${baseInstructionsVersion}:local:${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)}`,
      memoryIds: selected.map((record) => record.memoryId),
    };
  };

  const complete = async (call: { sessionId: string; orgId: string; callId: string | null; reason: string; occurredAt: string; provider: string }) => {
    const session = app.debrief.getSession(call.sessionId);
    await app.debrief.recordCallCompleted(call);
    await app.telemetry.append({
      id: crypto.randomUUID(),
      timestamp: call.occurredAt,
      orgId: call.orgId,
      appId: app.appId,
      customerId: session.customerId,
      sessionId: call.sessionId,
      traceId: call.sessionId,
      channel: "voice",
      pluginId: "kit:debrief",
      kitId: session.kitId,
      type: "voice.call",
      operation: "call_completed",
      provider: "local-openai-realtime",
      callId: call.callId,
      outcome: "success",
    });
  };

  const start = async (sessionId: string) => {
    const session = app.debrief.getSession(sessionId);
    if (session.state !== "prepared") throw new Error(`Local voice session must be prepared, received ${session.state}`);
    await app.debrief.markCalling(sessionId);
    const callId = `local-${crypto.randomUUID()}`;
    await app.debrief.setCallId(sessionId, callId);
    return {
      sessionId,
      callId,
      status: "connecting" as const,
      provider: "local-openai-realtime",
      sessionToken: await tokenCodec.sign({ sessionId, orgId: session.orgId, appId: app.appId }),
      mediaPath: "/t/voice/local/media",
      recording: false as const,
      retention: false as const,
    };
  };

  const bridge = (socket: VoiceWebSocket) => attachVoiceMediaBridge({
    socket,
    verifier: tokenCodec,
    openai,
    provider: "local-openai-realtime",
    stopReason: "local_stop",
    routingReason: modelRoute.reason,
    telemetry: app.telemetry,
    instructionsFor: async (binding) => (await voiceContextFor(binding)).content,
    onCallCompleted: complete,
    agent: async (binding, provider) => {
      const context = await voiceContextFor(binding);
      return createDefineAgentVoiceLoop({
        sessionId: binding.sessionId,
        orgId: binding.orgId,
        appId: binding.appId,
        instructions: { version: context.version, content: context.content },
        telemetry: app.telemetry,
        provider: "local-openai-realtime",
        model,
        routingReason: modelRoute.reason,
        callId: binding.callSid ?? null,
        memoryIds: context.memoryIds,
        tools: voiceTools.agent,
        sendToolResult: provider.sendToolResult,
        onStop: async () => { await app.debrief.awaitConfirmation(binding.sessionId); },
        onError: async (error) => {
          console.error(`[kitstack local voice] ${error.message}`);
          await app.debrief.markFailed(binding.sessionId, error);
        },
      });
    },
  });

  return {
    capability: { enabled: true, provider: "local-openai-realtime", model, startPath: "/t/voice/local/start", mediaPath: "/t/voice/local/media" },
    page: LOCAL_VOICE_PAGE,
    start,
    bridge,
  };
}

export const LOCAL_VOICE_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KitStack local voice</title>
<style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 20px;color:#17202a}input,button{font:inherit;padding:10px}input{width:100%;box-sizing:border-box;margin:8px 0 12px}button{cursor:pointer}#log{white-space:pre-wrap;background:#f3f5f7;padding:14px;border-radius:8px;min-height:80px;margin-top:18px}.muted{color:#667}</style></head>
<body><h1>KitStack local voice agent</h1><p class="muted">This uses your microphone and OpenAI Realtime locally. Twilio is not involved. Audio and transcript bodies are not persisted.</p>
<label>Prepared session ID <input id="session" placeholder="paste the session_id from prepare_debrief"></label>
<button id="start">Start local call</button> <button id="stop" disabled>Stop</button><div id="log">Ready.</div>
<script>
const session=document.querySelector('#session'), start=document.querySelector('#start'), stop=document.querySelector('#stop'), logEl=document.querySelector('#log');
let ws, audio, stream, source, processor, gain, nextOutput=0;
const log=(x)=>logEl.textContent=x;
function muLawToFloat(value){value=~value;let sign=value&128, exponent=(value>>4)&7, mantissa=value&15;let sample=((mantissa<<4)+132)<<exponent;return (sign?-sample:sample)/32768}
function floatToMuLaw(sample){let sign=sample<0?128:0;let magnitude=Math.min(32767,Math.abs(sample)*32767);let exponent=7;for(let mask=0x4000;exponent>0&&!(magnitude&mask);mask>>=1)exponent--;let mantissa=(magnitude>>(exponent?exponent+3:4))&15;return ~(sign|(exponent<<4)|mantissa)&255}
function downsample(input,fromRate,toRate){if(fromRate===toRate)return input;const ratio=fromRate/toRate,out=new Float32Array(Math.floor(input.length/ratio));for(let i=0;i<out.length;i++){const start=Math.floor(i*ratio),end=Math.min(input.length,Math.floor((i+1)*ratio));let sum=0;for(let j=start;j<end;j++)sum+=input[j];out[i]=sum/Math.max(1,end-start)}return out}
function encode(input){const out=new Uint8Array(input.length);for(let i=0;i<input.length;i++)out[i]=floatToMuLaw(input[i]);let binary='';for(const byte of out)binary+=String.fromCharCode(byte);return btoa(binary)}
function play(payload){const binary=atob(payload),buffer=audio.createBuffer(1,binary.length,8000),data=buffer.getChannelData(0);for(let i=0;i<binary.length;i++)data[i]=muLawToFloat(binary.charCodeAt(i));const node=audio.createBufferSource();node.buffer=buffer;node.connect(audio.destination);const now=audio.currentTime;nextOutput=Math.max(now,nextOutput);node.start(nextOutput);nextOutput+=buffer.duration}
async function stopCall(){if(ws){ws.send(JSON.stringify({event:'stop',streamSid:'local-stream'}));ws.close();ws=undefined}if(processor)processor.disconnect();if(source)source.disconnect();if(gain)gain.disconnect();if(stream)stream.getTracks().forEach(t=>t.stop());if(audio)await audio.close();start.disabled=false;stop.disabled=true;log('Call stopped. Use the Claude debrief tools to review and confirm it.')}
start.onclick=async()=>{try{if(!session.value.trim())throw Error('Paste a prepared session ID first');const response=await fetch('/t/voice/local/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:session.value.trim(),confirmation:true})});const result=await response.json();if(!response.ok)throw Error(result.message||result.error||'Could not start local call');audio=new AudioContext();stream=await navigator.mediaDevices.getUserMedia({audio:true});ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+result.mediaPath);ws.onopen=()=>ws.send(JSON.stringify({event:'start',streamSid:'local-stream',start:{streamSid:'local-stream',callSid:result.callId,customParameters:{kitstack_session_token:result.sessionToken}}}));ws.onmessage=(event)=>{const message=JSON.parse(event.data);if(message.event==='media')play(message.media.payload);if(message.event==='clear')nextOutput=audio.currentTime};ws.onerror=()=>log('WebSocket error. Check the local server and OPENAI_API_KEY.');ws.onclose=()=>{start.disabled=false;stop.disabled=true};source=audio.createMediaStreamSource(stream);processor=audio.createScriptProcessor(4096,1,1);gain=audio.createGain();gain.gain.value=0;processor.onaudioprocess=(event)=>{if(ws&&ws.readyState===1){const pcm=downsample(event.inputBuffer.getChannelData(0),event.inputBuffer.sampleRate,8000);ws.send(JSON.stringify({event:'media',streamSid:'local-stream',media:{payload:encode(pcm)}}))}};source.connect(processor);processor.connect(gain);gain.connect(audio.destination);start.disabled=true;stop.disabled=false;log('Connected. Speak into your microphone.');}catch(error){log(error.message);await stopCall()}};stop.onclick=stopCall;
</script></body></html>`;
