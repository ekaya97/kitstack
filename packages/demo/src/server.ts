import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";
import { createDemoApp, type DemoApp } from "./app/index.js";
import { handleDemoAppRequest } from "./http/app.js";

const DEFAULT_PORT = 3001;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const CORS_HEADERS = {
  "access-control-allow-headers": "authorization, content-type, x-demo-reset-token, x-request-id, x-session-id, x-trace-id, x-parent-id",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-origin": "*",
};

export interface DemoServerOptions {
  /** Use an ephemeral port (0) in tests. Defaults to PORT or 3001. */
  port?: number;
  /** Keep request bodies bounded; bodies are parsed and never persisted. */
  maxBodyBytes?: number;
  /** Supplying an app transfers lifecycle ownership to the caller. */
  app?: DemoApp;
  appOptions?: Parameters<typeof createDemoApp>[0];
}

export interface DemoServer {
  readonly server: Server;
  readonly app: DemoApp;
  readonly port: number;
  listen(): Promise<DemoServerAddress>;
  close(): Promise<void>;
}

export interface DemoServerAddress {
  host: string;
  port: number;
}

/**
 * Local-only adapter for the unreleased demo. Auth is intentionally absent so
 * a public tunnel is unsafe: use it only for a controlled demo. The simulator
 * is the default voice provider and provider recording/retention stay off.
 */
export async function createDemoServer(options: DemoServerOptions = {}): Promise<DemoServer> {
  const app = options.app ?? await createDemoApp(options.appOptions);
  const ownsApp = options.app === undefined;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    if (ownsApp) await app.close();
    throw new Error("maxBodyBytes must be a positive integer");
  }

  const requestedPort = options.port ?? parsePort(process.env.PORT) ?? DEFAULT_PORT;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    if (ownsApp) await app.close();
    throw new Error("port must be an integer between 0 and 65535");
  }

  let listening = false;
  let closed = false;
  const server = createServer((request, response) => {
    void handleIncomingRequest(request, response, app, maxBodyBytes);
  });

  return {
    server,
    app,
    port: requestedPort,
    async listen() {
      if (listening) return address(server);
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          listening = true;
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(requestedPort, "127.0.0.1");
      });
      return address(server);
    },
    async close() {
      if (closed) return;
      closed = true;
      if (listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
        listening = false;
      }
      if (ownsApp) await app.close();
    },
  };
}

async function handleIncomingRequest(
  request: IncomingMessage,
  response: ServerResponse,
  app: DemoApp,
  maxBodyBytes: number,
): Promise<void> {
  response.setHeader("content-type", "application/json");
  for (const [name, value] of Object.entries(CORS_HEADERS)) response.setHeader(name, value);

  if (request.method?.toUpperCase() === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", "http://demo.local");
    const body = await readJsonBody(request, maxBodyBytes);
    const result = await handleDemoAppRequest(app, {
      method: request.method ?? "GET",
      path: url.pathname,
      query: queryParams(url),
      headers: requestHeaders(request.headers),
      body,
    });
    response.statusCode = result.status;
    for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
    response.end(JSON.stringify(result.body));
  } catch (error) {
    const status = error instanceof BodyTooLargeError ? 413 : 400;
    response.statusCode = status;
    response.end(JSON.stringify({ error: status === 413 ? "body_too_large" : "invalid_request", message: error instanceof Error ? error.message : String(error) }));
  }
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<Record<string, unknown> | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) throw new BodyTooLargeError("request body exceeds limit");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) throw new BodyTooLargeError("request body exceeds limit");
    chunks.push(buffer);
  }
  if (total === 0) return undefined;
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function requestHeaders(headers: IncomingHttpHeaders): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) result[key] = Array.isArray(value) ? value[0] : value;
  return result;
}

function queryParams(url: URL): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) result[key] = value;
  return result;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function address(server: Server): DemoServerAddress {
  const value = server.address();
  if (value === null || typeof value === "string") throw new Error("demo server is not listening on a TCP port");
  return { host: value.address, port: value.port };
}

class BodyTooLargeError extends Error {}
