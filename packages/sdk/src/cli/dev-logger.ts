/**
 * Multiplexed dev server logger with channel filtering.
 *
 * All output goes to stderr (stdout reserved for stdio JSON-RPC).
 * In relay mode, single-key presses toggle channel visibility:
 *
 *   m — MCP protocol    t — tool calls    s — assets    a — all
 *
 * @module
 */

import pc from "picocolors";

export type Channel = "mcp" | "tool" | "asset";

export interface DevLogger {
  /** Print the startup banner (kit name, mode, stats, db path). */
  banner(opts: {
    name: string;
    mode: string;
    tools: number;
    views: number;
    db: string;
    uiUrl?: string;
  }): void;

  /** Log an MCP protocol request (initialize, tools/list, etc.). */
  mcp(method: string, ms: number): void;

  /** Log a successful tool call with name + truncated args. */
  tool(name: string, args: unknown, ms: number): void;

  /** Log a failed tool/MCP call. */
  error(label: string, message: string, ms: number): void;

  /** Log an asset request (dimmed — low visual priority). */
  asset(path: string, ms: number, sizeKB?: number): void;

  /** Log a failed asset request. */
  assetError(path: string, message: string, ms: number): void;

  /** Connection status indicator. */
  status(state: "connected" | "disconnected" | "connecting", detail?: string): void;

  /** Unstructured info line (always visible). */
  info(msg: string): void;

  /** JSON-RPC parse error (always visible). */
  parseError(): void;

  /**
   * Enable keyboard-driven channel filtering.
   * Only call in relay mode — stdin must not be used for JSON-RPC.
   * Returns a cleanup function that restores stdin.
   */
  enableKeyFilter(): () => void;
}

export function createDevLogger(): DevLogger {
  const visible: Record<Channel, boolean> = { mcp: true, tool: true, asset: true };
  const write = (msg: string) => process.stderr.write(msg + "\n");

  return {
    banner({ name, mode, tools, views, db, uiUrl }) {
      const parts = [`${tools} tool${tools !== 1 ? "s" : ""}`];
      if (views) parts.push(`${views} view${views !== 1 ? "s" : ""}`);
      write(`\n  ${pc.bold(name)}  ${pc.dim(mode)}`);
      write(`  ${pc.dim(parts.join(" \u00b7 ") + " \u00b7 " + db)}`);
      if (uiUrl) write(`  ${pc.dim("UI")}  ${uiUrl}`);
      write("");
    },

    mcp(method, ms) {
      if (!visible.mcp) return;
      write(`  ${pc.dim("mcp")}    ${pc.blue("\u2190 " + method)}  ${pc.dim(ms + "ms")}`);
    },

    tool(name, args, ms) {
      if (!visible.tool) return;
      const argsStr = args
        ? " " + pc.dim(JSON.stringify(args).slice(0, 60))
        : "";
      write(`  ${pc.dim("tool")}   ${pc.blue("\u2190 ")}${pc.bold(pc.blue(name))}${argsStr}  ${pc.dim(ms + "ms")}`);
    },

    error(label, message, ms) {
      write(`  ${pc.dim("tool")}   ${pc.red("\u2717 " + label + " \u2014 " + message)}  ${pc.dim(ms + "ms")}`);
    },

    asset(path, ms, sizeKB) {
      if (!visible.asset) return;
      const size = sizeKB != null ? `  ${sizeKB}KB` : "";
      write(`  ${pc.dim("asset  " + path + "  " + ms + "ms" + size)}`);
    },

    assetError(path, message, ms) {
      write(`  ${pc.dim("asset")}  ${pc.red("\u2717 " + path + " \u2014 " + message)}  ${pc.dim(ms + "ms")}`);
    },

    status(state, detail) {
      switch (state) {
        case "connected":
          write(`  ${pc.green("\u25cf")} Connected`);
          if (detail) write(`  ${detail}\n`);
          break;
        case "disconnected":
          write(`  ${pc.yellow("\u25cf")} Disconnected \u2014 reconnecting...`);
          break;
        case "connecting":
          write("  Connecting to relay...\n");
          break;
      }
    },

    info(msg) {
      write("  " + msg);
    },

    parseError() {
      write(`  ${pc.red("\u2717 parse error")}`);
    },

    enableKeyFilter() {
      if (!process.stdin.isTTY) return () => {};

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const showStatus = () => {
        const parts = (Object.entries(visible) as [Channel, boolean][]).map(
          ([ch, v]) => (v ? pc.bold(ch) : pc.dim(pc.strikethrough(ch)))
        );
        write(`\n  ${pc.dim("filter:")} ${parts.join(pc.dim(" \u00b7 "))}  ${pc.dim("(?  help)")}`);
      };

      const handler = (key: string) => {
        if (key === "\x03") process.exit(0); // Ctrl+C

        const map: Record<string, Channel> = { m: "mcp", t: "tool", s: "asset" };
        if (key in map) {
          visible[map[key]] = !visible[map[key]];
          showStatus();
          return;
        }
        if (key === "a") {
          const allOn = Object.values(visible).every(Boolean);
          for (const k of Object.keys(visible) as Channel[]) visible[k] = !allOn;
          showStatus();
          return;
        }
        if (key === "?") {
          write("");
          write(`  ${pc.bold("Log filters:")}`);
          write(`  ${pc.dim("m")} mcp    ${pc.dim("t")} tools    ${pc.dim("s")} assets    ${pc.dim("a")} all`);
          write("");
        }
      };

      process.stdin.on("data", handler);

      return () => {
        process.stdin.removeListener("data", handler);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
      };
    },
  };
}
