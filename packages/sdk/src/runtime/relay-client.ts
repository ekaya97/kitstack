/**
 * WebSocket relay client for `kitstack dev` relay mode.
 *
 * Connects to the DevRelay WebSocket API Gateway, receives MCP requests
 * forwarded from the McpRouter, processes them locally via the MCP handler,
 * and sends responses back through the WebSocket.
 *
 * The relay enables any LLM client to connect to a local dev server via
 * a public URL (`https://mcp.kitstack.co/dev/{sessionId}`) without
 * the developer exposing ports or configuring tunnels.
 *
 * @example
 * ```typescript
 * import { connectRelay } from "./relay-client";
 *
 * await connectRelay({
 *   sessionId: "abc123",
 *   token: "kst_...",
 *   handler,
 *   relayUrl: "wss://relay.kitstack.co",
 * });
 * ```
 *
 * @module
 */

import type { McpHandler, JsonRpcRequest } from "./mcp-handler";

export interface RelayOptions {
  /** Unique session ID for this dev session. */
  sessionId: string;
  /** CLI auth token (from ~/.kitstack/credentials.json). */
  token: string;
  /** The MCP handler instance to process incoming requests. */
  handler: McpHandler;
  /** WebSocket URL. Default: wss://relay.kitstack.co */
  relayUrl?: string;
  /** Called when the relay is connected and ready. */
  onReady?: () => void;
  /** Called when the connection is lost (before reconnect). */
  onDisconnect?: () => void;
  /** Local Vite dev server port for asset serving. Default: 5175 */
  vitePort?: number;
}

/**
 * Connect to the DevRelay and process MCP requests.
 *
 * Automatically reconnects with exponential backoff (1s, 2s, 4s, max 30s)
 * on connection loss. The returned promise never resolves — the relay
 * runs until the process exits.
 */
export async function connectRelay(opts: RelayOptions): Promise<never> {
  const {
    sessionId,
    token,
    handler,
    relayUrl = "wss://relay.kitstack.co",
    onReady,
    onDisconnect,
  } = opts;

  const url = `${relayUrl}?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
  let backoff = 1000;

  async function connect(): Promise<void> {
    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      backoff = 1000; // Reset backoff on successful connection
      onReady?.();
    });

    ws.addEventListener("message", async (event) => {
      let message: any;
      try {
        message = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      } catch {
        return;
      }

      const { requestId } = message;
      if (!requestId) return;

      // Asset request — fetch from local Vite dev server
      if (message.type === "asset") {
        const assetPath = message.path as string;
        console.error(`  ← asset ${assetPath}`);
        try {
          const vitePort = opts.vitePort || 5175;
          // Vite serves at root — no base prefix needed for local fetch
          const res = await fetch(`http://localhost:${vitePort}/${assetPath}`);
          const body = await res.text();
          const contentType = res.headers.get("content-type") || "application/javascript";
          console.error(`  → ${res.status} (${contentType.split(";")[0]})`);
          ws.send(JSON.stringify({
            requestId,
            result: { status: res.status, contentType, body },
          }));
        } catch (err: any) {
          console.error(`  → FAIL (${err.message})`);
          ws.send(JSON.stringify({
            requestId,
            result: { status: 502, contentType: "text/plain", body: `Vite not reachable: ${err.message}` },
          }));
        }
        return;
      }

      // MCP request
      const { method, params } = message;
      if (!method) return;

      console.error(`  ← ${method}${params ? ` ${JSON.stringify(params).slice(0, 80)}` : ""}`);

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: requestId,
        method,
        params,
      };

      const response = await handler.handleRequest(request);

      if (response) {
        const isError = response.error != null;
        console.error(`  → ${isError ? "ERROR" : "OK"} (${method})`);
        ws.send(JSON.stringify({ requestId, result: response.result ?? response.error }));
      } else {
        console.error(`  → ACK (${method})`);
        ws.send(JSON.stringify({ requestId, result: null }));
      }
    });

    ws.addEventListener("close", () => {
      onDisconnect?.();
      // Reconnect with exponential backoff
      setTimeout(() => {
        backoff = Math.min(backoff * 2, 30000);
        connect();
      }, backoff);
    });

    ws.addEventListener("error", () => {
      // Error will be followed by close event, which triggers reconnect
    });
  }

  await connect();

  // Keep the process alive
  return new Promise(() => {});
}
