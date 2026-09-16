import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTelemetryStore, type TelemetryStore } from "../telemetry/index.js";
import {
  createInstructionPlugin,
  DEBRIEF_KIT_ID,
  InstructionKitNotFoundError,
  InstructionResolutionError,
  INSTRUCTION_PLUGIN_ID,
  loadInstructionManifestFromFile,
} from "./index.js";

let telemetry: TelemetryStore | undefined;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await telemetry?.close();
  telemetry = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function makeTelemetry(): Promise<TelemetryStore> {
  telemetry = await createTelemetryStore({ url: ":memory:" });
  return telemetry;
}

function context(store: TelemetryStore) {
  return {
    orgId: "org-demo",
    appId: "app-sales",
    sessionId: "session-1",
    traceId: "trace-1",
    parentId: "parent-1",
    telemetry: store,
    lookupPlugin: () => undefined,
  };
}

describe("file-backed instruction plugin", () => {
  it("loads the baseline from a file and returns stable version/hash metadata", async () => {
    const store = await makeTelemetry();
    const plugin = createInstructionPlugin();
    const first = await plugin.invoke({ kitId: DEBRIEF_KIT_ID }, context(store));
    const second = await plugin.invoke({ kitId: DEBRIEF_KIT_ID }, context(store));

    expect(first.id).toBe(INSTRUCTION_PLUGIN_ID);
    expect(first.content).toContain("sales debrief interviewer");
    expect(first.source).toContain("debrief-baseline.md");
    expect(first.version).toBe(`sha256:${first.hash}`);
    expect(second).toMatchObject({ version: first.version, hash: first.hash });
  });

  it("loads an injected manifest without requiring filesystem access", async () => {
    const store = await makeTelemetry();
    const plugin = createInstructionPlugin({
      manifest: {
        entries: [{
          id: "instructions:test",
          kitId: DEBRIEF_KIT_ID,
          context: "voice",
          content: "Ask for one concrete next step.",
          version: "debrief-voice-v1",
        }],
      },
    });

    const result = await plugin.resolve({ kitId: DEBRIEF_KIT_ID, context: { name: "voice" } }, context(store));
    expect(result).toMatchObject({
      id: "instructions:test",
      version: "debrief-voice-v1",
      source: "injected-manifest",
      content: "Ask for one concrete next step.",
    });
    expect(result.hash).toHaveLength(64);
  });

  it("resolves deterministically by kit, context, and locale", async () => {
    const store = await makeTelemetry();
    const plugin = createInstructionPlugin({
      manifest: {
        entries: [
          { id: "voice-neutral", kitId: DEBRIEF_KIT_ID, context: "voice", content: "neutral" },
          { id: "voice-de", kitId: DEBRIEF_KIT_ID, context: "voice", locale: "de", content: "deutsch" },
          { id: "prebrief", kitId: DEBRIEF_KIT_ID, context: "prebrief", content: "prepare" },
        ],
      },
    });

    await expect(plugin.resolve({ kitId: DEBRIEF_KIT_ID, context: { name: "voice", locale: "de" } }, context(store)))
      .resolves.toMatchObject({ id: "voice-de", content: "deutsch" });
    await expect(plugin.resolve({ kitId: DEBRIEF_KIT_ID, context: { name: "prebrief" } }, context(store)))
      .resolves.toMatchObject({ id: "prebrief", content: "prepare" });
  });

  it("reports missing kits and contexts explicitly", async () => {
    const store = await makeTelemetry();
    const plugin = createInstructionPlugin({
      manifest: { entries: [{ id: "one", kitId: DEBRIEF_KIT_ID, content: "one" }] },
    });

    await expect(plugin.resolve({ kitId: "kit:missing" }, context(store))).rejects.toThrow(InstructionKitNotFoundError);
    await expect(plugin.resolve({ kitId: DEBRIEF_KIT_ID, context: { name: "voice" } }, context(store)))
      .rejects.toThrow(InstructionResolutionError);
  });

  it("supports a file-backed injected manifest entry", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kitstack-instructions-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "voice.md");
    writeFileSync(filePath, "Read back the confirmed next step.", "utf8");
    const store = await makeTelemetry();
    const manifest = loadInstructionManifestFromFile(filePath, {
      id: "instructions:file",
      kitId: DEBRIEF_KIT_ID,
      context: "voice",
    });
    const plugin = createInstructionPlugin({ manifest });

    await expect(plugin.invoke({ kitId: DEBRIEF_KIT_ID, context: { name: "voice" } }, context(store)))
      .resolves.toMatchObject({ id: "instructions:file", content: "Read back the confirmed next step." });
  });

  it("emits metadata-only instruction.served telemetry with identity and version", async () => {
    const store = await makeTelemetry();
    const plugin = createInstructionPlugin({
      manifest: { entries: [{ id: "instructions:test", kitId: DEBRIEF_KIT_ID, content: "safe body", version: "v1" }] },
    });
    await plugin.invoke({ kitId: DEBRIEF_KIT_ID }, context(store));

    const events = await store.query({ type: "instruction.served" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      orgId: "org-demo",
      appId: "app-sales",
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
      pluginId: INSTRUCTION_PLUGIN_ID,
      kitId: DEBRIEF_KIT_ID,
      instructionVersions: ["v1"],
    });
  });

  it("does not retain the instruction body in telemetry or expose locked status", async () => {
    const store = await makeTelemetry();
    const body = "private instruction body that must never be persisted";
    const plugin = createInstructionPlugin({
      manifest: { entries: [{ id: "instructions:test", kitId: DEBRIEF_KIT_ID, content: body }] },
    });
    const result = await plugin.invoke({ kitId: DEBRIEF_KIT_ID }, context(store));
    const event = (await store.query({ type: "instruction.served" }))[0];

    expect(result.content).toBe(body);
    expect(event).not.toHaveProperty("content");
    expect(event).not.toHaveProperty("prompt");
    expect(event).not.toHaveProperty("completion");
    expect(event).not.toHaveProperty("transcript");
    expect(JSON.stringify(event)).not.toContain(body);
    expect(result).not.toHaveProperty("locked");
  });
});
