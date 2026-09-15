import { createInterface, type Interface } from "node:readline";
import { pathToFileURL } from "node:url";
import { createDemoApp, type DemoApp } from "../app/index.js";

const PROTOCOL_VERSION = "2025-11-25";
const SERVER_INFO = { name: "kitstack-demo", version: "0.1.0" };

const TOOL_DEFINITIONS = [
  {
    name: "prepare_debrief",
    description: "Prepare a sales debrief using the current instructions and approved memories.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The sales goal for the debrief." },
        company: { type: "string", description: "The customer company." },
        contact_name: { type: "string", description: "The customer contact." },
        location: { type: "string", description: "The meeting or customer location." },
        callback_at: { type: "string", description: "When the phone should ring: ISO timestamp or HH:mm." },
        callback_timezone: { type: "string", description: "IANA timezone for callback_at." },
        buffer_minutes: { type: "number", description: "Optional delay after callback_at before starting the call." },
      },
      required: ["goal", "company", "contact_name", "location", "callback_at", "callback_timezone"],
    },
  },
  {
    name: "get_session",
    description: "Read the complete state of a prepared debrief session.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    name: "get_debrief",
    description: "Read the compact status summary for a debrief session.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    name: "confirm_debrief",
    description: "Confirm a completed debrief, or record a partial outcome.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        outcome: { type: "string", enum: ["confirmed", "partial"] },
      },
      required: ["session_id", "outcome"],
    },
  },
  {
    name: "teach_from_correction",
    description: "Store operator feedback as a candidate memory for a later run.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        correction: { type: "string" },
      },
      required: ["session_id", "correction"],
    },
  },
  {
    name: "approve_memory",
    description: "Approve a candidate memory taught during this debrief.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" }, memory_id: { type: "string" } },
      required: ["session_id", "memory_id"],
    },
  },
  {
    name: "publish_memory",
    description: "Publish an approved memory for retrieval by a later debrief.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" }, memory_id: { type: "string" } },
      required: ["session_id", "memory_id"],
    },
  },
  {
    name: "start_voice_call",
    description: "Start the deterministic German sales voice call for a prepared debrief.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    name: "get_voice_status",
    description: "Poll the sales voice call until it reaches confirmation.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
] as const;

export type DemoMcpToolName = (typeof TOOL_DEFINITIONS)[number]["name"];

export interface DemoMcpRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface DemoMcpResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface DemoMcpStdioOptions {
  /** Supplying an app transfers app lifecycle ownership to the caller. */
  app?: DemoApp;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  appOptions?: Parameters<typeof createDemoApp>[0];
}

export interface DemoMcpStdio {
  readonly app: DemoApp;
  handleRequest(request: DemoMcpRequest): Promise<DemoMcpResponse | null>;
  run(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Standard newline-delimited MCP transport for the local sales demo.
 *
 * This adapter intentionally owns only the demo protocol boundary. It uses
 * the same DemoApp services as the HTTP demo route, while remaining usable by
 * Claude Desktop/Code-style process clients that speak MCP over stdio.
 */
export async function createDemoMcpStdio(
  options: DemoMcpStdioOptions = {},
): Promise<DemoMcpStdio> {
  const app = options.app ?? await createDemoApp(options.appOptions);
  const ownsApp = options.app === undefined;
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  let closed = false;
  let readline: Interface | undefined;

  const adapter: DemoMcpStdio = {
    app,

    async handleRequest(request) {
      return handleRequest(app, request);
    },

    async run() {
      if (readline) throw new Error("The demo MCP stdio transport is already running");
      readline = createInterface({ input });
      try {
        for await (const line of readline) {
          const response = await processLine(line, adapter.handleRequest);
          if (response !== null) output.write(`${JSON.stringify(response)}\n`);
        }
      } finally {
        readline.close();
        readline = undefined;
        if (ownsApp) await adapter.close();
      }
    },

    async close() {
      if (closed) return;
      closed = true;
      readline?.close();
      if (ownsApp) await app.close();
    },
  };

  return adapter;
}

/** Start the process transport used by local MCP clients. */
export async function runDemoMcpStdio(
  options: DemoMcpStdioOptions = {},
): Promise<void> {
  const adapter = await createDemoMcpStdio(options);
  await adapter.run();
}

async function processLine(
  line: string,
  handler: (request: DemoMcpRequest) => Promise<DemoMcpResponse | null>,
): Promise<DemoMcpResponse | null> {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  if (!isRequest(value)) return rpcError(null, -32600, "Invalid Request");
  return handler(value);
}

async function handleRequest(
  app: DemoApp,
  request: DemoMcpRequest,
): Promise<DemoMcpResponse | null> {
  switch (request.method) {
    case "initialize":
      return rpcResult(request.id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      });
    case "notifications/initialized":
      return null;
    case "ping":
      return rpcResult(request.id, {});
    case "tools/list":
      return rpcResult(request.id, { tools: TOOL_DEFINITIONS });
    case "tools/call":
      return callTool(app, request);
    default:
      return rpcError(request.id, -32601, `Method not found: ${request.method}`);
  }
}

async function callTool(
  app: DemoApp,
  request: DemoMcpRequest,
): Promise<DemoMcpResponse> {
  const params = asRecord(request.params);
  const name = params?.name;
  const args = asRecord(params?.arguments) ?? {};
  if (typeof name !== "string" || !isToolName(name)) {
    return rpcError(request.id, -32602, "A valid tool name is required");
  }

  try {
    let value: unknown;
    if (name === "prepare_debrief") {
      const hasPresenterFields = ["company", "contact_name", "location", "callback_at", "callback_timezone", "buffer_minutes"]
        .some((field) => args[field] !== undefined);
      value = hasPresenterFields
        ? await app.debrief.prepareDebrief({
          goal: requiredString(args, "goal"),
          company: requiredString(args, "company"),
          contactName: requiredString(args, "contact_name"),
          location: requiredString(args, "location"),
          callbackAt: requiredString(args, "callback_at"),
          callbackTimezone: requiredString(args, "callback_timezone"),
          bufferMinutes: optionalNumber(args, "buffer_minutes", 0),
        })
        : await app.debrief.prepareDebrief(requiredString(args, "goal"));
    } else if (name === "get_session") {
      value = app.debrief.getSession(requiredString(args, "session_id"));
    } else if (name === "get_debrief") {
      value = app.debrief.getDebrief(requiredString(args, "session_id"));
    } else if (name === "confirm_debrief") {
      const outcome = requiredString(args, "outcome");
      if (outcome !== "confirmed" && outcome !== "partial") {
        return rpcError(request.id, -32602, "outcome must be confirmed or partial");
      }
      value = await app.voice.complete(requiredString(args, "session_id"), outcome);
    } else if (name === "approve_memory") {
      value = await app.debrief.approveMemory({
        sessionId: requiredString(args, "session_id"),
        memoryId: requiredString(args, "memory_id"),
      });
    } else if (name === "publish_memory") {
      value = await app.debrief.publishMemory({
        sessionId: requiredString(args, "session_id"),
        memoryId: requiredString(args, "memory_id"),
      });
    } else if (name === "teach_from_correction") {
      value = await app.debrief.teachFromCorrection(
        requiredString(args, "session_id"),
        requiredString(args, "correction"),
      );
    } else if (name === "start_voice_call") {
      value = await app.voice.start(requiredString(args, "session_id"));
    } else if (name === "get_voice_status") {
      const sessionId = requiredString(args, "session_id");
      const current = app.voice.status(sessionId);
      value = current.status === "calling" ? await app.voice.advance(sessionId) : current;
    } else {
      return rpcError(request.id, -32602, `Unknown tool ${name}`);
    }
    return rpcResult(request.id, { content: [{ type: "text", text: JSON.stringify(value) }] });
  } catch (error) {
    return rpcError(request.id, -32603, error instanceof Error ? error.message : String(error));
  }
}

function isRequest(value: unknown): value is DemoMcpRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.jsonrpc === "2.0" && typeof candidate.method === "string";
}

function isToolName(value: string): value is DemoMcpToolName {
  return TOOL_DEFINITIONS.some((tool) => tool.name === value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function requiredString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

function optionalNumber(body: Record<string, unknown>, name: string, fallback: number): number {
  const value = body[name];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

function rpcResult(id: string | number | null | undefined, result: unknown): DemoMcpResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: string | number | null | undefined, code: number, message: string): DemoMcpResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runDemoMcpStdio();
}
