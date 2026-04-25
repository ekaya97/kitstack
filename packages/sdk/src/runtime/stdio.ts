/**
 * Stdio transport for the MCP JSON-RPC protocol.
 *
 * Reads newline-delimited JSON-RPC messages from stdin, routes them through
 * the McpHandler, and writes responses to stdout. All diagnostic output
 * goes to stderr — stdout is reserved for the protocol.
 *
 * Wire format: one JSON object per line (NDJSON), matching the MCP SDK's
 * StdioServerTransport convention.
 *
 * Usage:
 *   const handler = createMcpHandler({ kit, db });
 *   await runStdioTransport(handler);
 *
 * Used by `kitstack dev --stdio` for local development with Claude Desktop/Code.
 *
 * T-0026
 */

import type { Readable, Writable } from "node:stream";
import type { McpHandler, JsonRpcRequest } from "./mcp-handler";

/**
 * Options for customizing the stdio transport's I/O streams.
 *
 * All streams default to the standard process streams (`stdin`, `stdout`,
 * `stderr`). Override them to inject test doubles or redirect I/O in
 * embedded scenarios.
 *
 * @example
 * ```typescript
 * import { runStdioTransport } from "@kitstack/sdk/runtime/stdio";
 * import { PassThrough } from "node:stream";
 *
 * const fakeIn = new PassThrough();
 * const fakeOut = new PassThrough();
 * await runStdioTransport(handler, { input: fakeIn, output: fakeOut });
 * ```
 */
export interface StdioTransportOptions {
  /**
   * Readable stream to read JSON-RPC requests from.
   * Defaults to `process.stdin`.
   */
  input?: Readable;

  /**
   * Writable stream to write JSON-RPC responses to.
   * Defaults to `process.stdout`.
   */
  output?: Writable;

  /**
   * Writable stream for diagnostic logging.
   * Defaults to `process.stderr`.
   */
  logger?: Writable;
}

/**
 * Run the MCP handler over stdio (NDJSON on stdin/stdout).
 *
 * Reads newline-delimited JSON-RPC messages from the input stream, routes
 * each through `handler.handleRequest()`, and writes responses back.
 * Diagnostic output goes to the logger stream (stderr by default) so that
 * stdout remains a clean protocol channel.
 *
 * The returned promise resolves when stdin closes or a `SIGINT`/`SIGTERM`
 * signal is received, making it safe to `await` in a top-level script.
 *
 * Used internally by `kitstack dev --stdio` and by the `serve()` function
 * in stdio mode.
 *
 * @param handler - MCP handler created by {@link createMcpHandler}.
 * @param opts    - Optional overrides for I/O streams (see {@link StdioTransportOptions}).
 *
 * @example
 * ```typescript
 * // Typical usage inside `kitstack dev --stdio`
 * import { createMcpHandler } from "@kitstack/sdk/runtime/mcp-handler";
 * import { runStdioTransport } from "@kitstack/sdk/runtime/stdio";
 * import kit from "./kit.config";
 *
 * const handler = createMcpHandler({ kit, db });
 * await runStdioTransport(handler);
 * ```
 */
export async function runStdioTransport(
  handler: McpHandler,
  opts?: StdioTransportOptions
): Promise<void> {
  const input = opts?.input ?? process.stdin;
  const output = opts?.output ?? process.stdout;
  const logger = opts?.logger ?? process.stderr;

  function log(msg: string): void {
    logger.write(`[kitstack] ${msg}\n`);
  }

  function send(data: unknown): void {
    output.write(JSON.stringify(data) + "\n");
  }

  // Buffer for partial lines — stdin chunks may not align with line boundaries
  let buffer = "";

  async function processLine(line: string): Promise<void> {
    if (!line) return;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
    } catch {
      log(`Invalid JSON received, ignoring: ${line.slice(0, 120)}`);
      return;
    }

    // Validate minimal JSON-RPC shape
    if (!request || typeof request !== "object" || request.jsonrpc !== "2.0") {
      log(`Invalid JSON-RPC message (missing jsonrpc:"2.0"), ignoring`);
      return;
    }

    try {
      const response = await handler.handleRequest(request);
      // Notifications (no `id`) return null — don't send anything back
      if (response !== null) {
        send(response);
      }
    } catch (err: any) {
      // Unexpected handler error — send a JSON-RPC internal error if we have a request id
      log(`Handler error: ${err.message}`);
      if (request.id !== undefined && request.id !== null) {
        send({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: err.message ?? "Internal error" },
        });
      }
    }
  }

  return new Promise<void>((resolve) => {
    let shutdownCalled = false;

    function shutdown(): void {
      if (shutdownCalled) return;
      shutdownCalled = true;
      log("Shutting down stdio transport");

      // Remove listeners to prevent double-fire
      input.removeAllListeners("data");
      input.removeAllListeners("end");
      process.removeListener("SIGINT", shutdown);
      process.removeListener("SIGTERM", shutdown);

      resolve();
    }

    input.on("data", (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");

      // Process all complete lines in the buffer
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, "");
        buffer = buffer.slice(newlineIdx + 1);
        // Fire and forget — responses are written as they complete.
        // We don't await here because the MCP protocol allows pipelining:
        // the client can send multiple requests before waiting for responses.
        void processLine(line);
      }
    });

    input.on("end", shutdown);
    input.on("error", (err) => {
      log(`Input stream error: ${err.message}`);
      shutdown();
    });

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    log(`MCP stdio transport ready (handler has ${handler.tools.length} tools)`);
  });
}
