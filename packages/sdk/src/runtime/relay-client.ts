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
import type { DevLogger } from "../cli/dev-logger";

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
  /**
   * Full CDN URL for vendor.js (React/ReactDOM bundle).
   * When set, React-related imports from Vite's pre-bundled deps are
   * rewritten to this URL instead of going through the relay, avoiding
   * the 128KB WebSocket message limit. (T-0085)
   */
  cdnVendorUrl?: string;
  /** Dev logger for formatted output. */
  logger: DevLogger;
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
        const t0 = performance.now();
        try {
          // Stub out @vite/client — it's the HMR runtime (~136KB), useless
          // through the relay (no push connection to Vite dev server).
          // Return a no-op module so CSS modules that import it don't break.
          if (assetPath === "@vite/client" || assetPath === "/@vite/client") {
            const stub = [
              "export function createHotContext(){return{accept(){},dispose(){},prune(){},invalidate(){},on(){}}};",
              "export function updateStyle(id,css){let e=document.getElementById(id);if(!e){e=document.createElement('style');e.id=id;e.setAttribute('type','text/css');document.head.appendChild(e)}e.textContent=css};",
              "export function removeStyle(id){document.getElementById(id)?.remove()};",
            ].join("");
            const ms = Math.round(performance.now() - t0);
            opts.logger.asset(assetPath + " (stub)", ms, 0);
            ws.send(JSON.stringify({
              requestId,
              result: { status: 200, contentType: "application/javascript", body: stub },
            }));
            return;
          }

          // Shim React/ReactDOM/jsx-runtime (T-0085).
          // Vite's pre-bundled react.js is ~188KB — too large for the 128KB
          // WebSocket limit. Instead of relaying the real file, serve a tiny
          // shim that imports from CDN vendor.js and re-exports with the
          // standard names (useState, createRoot, jsx, etc.).
          // vendor.js exports namespace objects (reactExports, clientExports,
          // jsxRuntimeExports) — the shims destructure them into individual
          // named exports matching what Vite consumers expect.
          if (opts.cdnVendorUrl && assetPath.includes("node_modules/.vite/deps/react")) {
            let shim: string;
            if (assetPath.includes("react-dom")) {
              // react-dom/client → createRoot, hydrateRoot
              shim = `import{clientExports as m}from"${opts.cdnVendorUrl}";export default m;export const{createRoot,hydrateRoot}=m;`;
            } else if (assetPath.includes("react_jsx")) {
              // react/jsx-runtime or react/jsx-dev-runtime → jsx, jsxs, Fragment
              shim = `import{jsxRuntimeExports as m}from"${opts.cdnVendorUrl}";export default m;export const{jsx,jsxs,Fragment}=m;`;
            } else {
              // react → default + all named exports
              shim = [
                `import{reactExports as m}from"${opts.cdnVendorUrl}";`,
                `export default m;`,
                `export const{useState,useEffect,useCallback,useMemo,useRef,useContext,`,
                `createContext,createElement,Fragment,forwardRef,memo,lazy,Suspense,`,
                `Children,cloneElement,isValidElement,startTransition,useTransition,`,
                `useDeferredValue,useId,use,version,act}=m;`,
              ].join("");
            }
            const ms = Math.round(performance.now() - t0);
            opts.logger.asset(assetPath + " (shim)", ms, 0);
            ws.send(JSON.stringify({
              requestId,
              result: { status: 200, contentType: "application/javascript", body: shim },
            }));
            return;
          }

          const vitePort = opts.vitePort || 5175;
          const res = await fetch(`http://localhost:${vitePort}/${assetPath}`);
          let body = await res.text();
          const contentType = res.headers.get("content-type") || "application/javascript";

          // Rewrite absolute import paths in JS responses.
          // Vite transforms imports to absolute paths like /src/views/styles.css
          // or /node_modules/.vite/deps/react.js.
          if (contentType.includes("javascript")) {
            const devBase = `/dev/${opts.sessionId}`;

            // Prefix absolute imports with the relay base path.
            // React imports go through the relay too, but get intercepted
            // above and served as shims (never reaching Vite).
            body = body
              .replace(/from\s+"(\/[^"]+)"/g, `from "${devBase}$1"`)
              .replace(/from\s+'(\/[^']+)'/g, `from '${devBase}$1'`)
              .replace(/import\(\s*"(\/[^"]+)"\s*\)/g, `import("${devBase}$1")`)
              .replace(/import\(\s*'(\/[^']+)'\s*\)/g, `import('${devBase}$1')`)
              // Side-effect imports: import "/src/views/styles.css"
              .replace(/import\s+"(\/[^"]+)"/g, `import "${devBase}$1"`)
              .replace(/import\s+'(\/[^']+)'/g, `import '${devBase}$1'`);
          }
          const payload = JSON.stringify({
            requestId,
            result: { status: res.status, contentType, body },
          });
          const ms = Math.round(performance.now() - t0);

          // API Gateway WebSocket limit: 128KB per message.
          // JSON-serialized body is larger than raw (escaping \n, \", etc).
          const payloadKB = Math.round(payload.length / 1024);
          if (payload.length > 120_000) {
            opts.logger.assetError(assetPath, `TOO LARGE for WebSocket (${payloadKB}KB > 128KB limit)`, ms);
            ws.send(JSON.stringify({
              requestId,
              result: { status: 413, contentType: "text/plain", body: `Asset too large for relay (${payloadKB}KB): ${assetPath}` },
            }));
            return;
          }

          opts.logger.asset(assetPath, ms, payloadKB);
          ws.send(payload);
        } catch (err: any) {
          const ms = Math.round(performance.now() - t0);
          opts.logger.assetError(assetPath, err.message, ms);
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

      const t0 = performance.now();

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: requestId,
        method,
        params,
      };

      const response = await handler.handleRequest(request);

      const ms = Math.round(performance.now() - t0);

      if (response) {
        const isError = response.error != null;
        if (isError) {
          const errMsg = typeof response.error === "object" ? (response.error as any).message : "Error";
          opts.logger.error(method, errMsg, ms);
        } else if (method === "tools/call" && params?.name) {
          opts.logger.tool(params.name, params.arguments, ms);
        } else {
          opts.logger.mcp(method, ms);
        }
        const mcpPayload = JSON.stringify({ requestId, result: response.result ?? response.error });
        const mcpKB = Math.round(mcpPayload.length / 1024);
        if (mcpPayload.length > 120_000) {
          opts.logger.error(method, `Response too large for WebSocket (${mcpKB}KB)`, ms);
          ws.send(JSON.stringify({ requestId, result: { content: [{ type: "text", text: `Response too large for relay (${mcpKB}KB). Deploy and use production URL.` }], isError: true } }));
        } else {
          if (mcpKB > 30) console.error(`  [ws] ${method} payload: ${mcpKB}KB`);
          ws.send(mcpPayload);
        }
      } else {
        ws.send(JSON.stringify({ requestId, result: null }));
      }
    });

    ws.addEventListener("close", (ev) => {
      console.error(`  [ws] close code=${(ev as CloseEvent).code} reason=${(ev as CloseEvent).reason || "(none)"}`);
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
