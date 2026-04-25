/**
 * DevKit HTTP server — serves the DevKit UI and provides API endpoints
 * for loader execution and tool dispatch.
 *
 * Endpoints:
 *   GET  /                     → DevKit host page (app.html)
 *   GET  /__devkit/shell       → App shell HTML
 *   GET  /__devkit/proxy       → Mock sandbox proxy HTML
 *   GET  /__devkit/loader/:slug → Execute view loader, return JSON
 *   POST /__devkit/tool        → Execute tool, return KitToolResult
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitContext } from "../types";
import { generateProxyHtml } from "./proxy";

export interface DevKitServerOptions {
  kit: KitDefinition;
  db: LibSQLDatabase;
  port?: number;
  shellHtml?: string;
}

export async function startDevKitServer(options: DevKitServerOptions): Promise<void> {
  const { kit, db, port = 5174 } = options;
  const ctx: KitContext = { userId: "dev-user", kitId: kit.id };

  const toolMap = new Map(kit.tools.map((t) => [t.name, t]));
  const viewMap = new Map((kit.views ?? []).map((v) => [v.slug, v]));

  // Read the host page HTML and inject kit metadata
  const appHtmlPath = resolve(import.meta.dirname, "app.html");
  const appHtmlRaw = readFileSync(appHtmlPath, "utf-8");

  const kitMeta = {
    id: kit.id,
    name: kit.name,
    tools: kit.tools.map((t) => ({ name: t.name, description: t.description })),
    views: (kit.views ?? []).map((v) => ({ slug: v.slug, name: v.name, description: v.description })),
  };

  const appHtml = appHtmlRaw.replace(
    "</head>",
    `<script>window.__DEVKIT_KIT__ = ${JSON.stringify(kitMeta)};</script>\n</head>`
  );

  const proxyHtml = generateProxyHtml();

  // Minimal shell HTML for DevKit — loads view modules from Vite dev server
  const shellHtml = options.shellHtml || generateDevShellHtml(kit);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // Host page
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(appHtml);
      return;
    }

    // Shell HTML
    if (url.pathname === "/__devkit/shell") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml);
      return;
    }

    // Proxy HTML
    if (url.pathname === "/__devkit/proxy") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(proxyHtml);
      return;
    }

    // Loader execution
    if (url.pathname.startsWith("/__devkit/loader/")) {
      const slug = url.pathname.split("/").pop()!;
      const view = viewMap.get(slug);
      if (!view) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `View "${slug}" not found` }));
        return;
      }

      try {
        const data = await view.loader(db, ctx);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Tool execution
    if (url.pathname === "/__devkit/tool" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());

      const { toolName, args = {} } = body;
      const tool = toolMap.get(toolName);
      if (!tool) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true }));
        return;
      }

      try {
        const parsed = tool.args.parse(args);
        const result = await tool.handler!(db, parsed, ctx);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ content: [{ type: "text", text: `Error: ${err.message}` }], isError: true }));
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    process.stderr.write(
      `\n  KitStack View DevKit\n` +
      `  Kit: ${kit.name} (${kit.tools.length} tools, ${kit.views?.length ?? 0} views)\n` +
      `  DB:  .kitstack/dev.db\n\n` +
      `  http://localhost:${port}\n\n` +
      `  Watching for changes...\n\n`
    );
  });
}

function generateDevShellHtml(kit: KitDefinition): string {
  // A minimal shell that works with the DevKit. In dev mode, view modules
  // would be served by Vite, but for now we provide a basic shell that
  // renders pre-loaded data as formatted JSON.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, sans-serif; padding: 16px; margin: 0; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; }
  h3 { margin-bottom: 8px; font-size: 14px; }
</style>
</head>
<body>
<div id="root">Loading view...</div>
<script>
let requestId = 0;
const pending = new Map();

function send(msg) { window.parent.postMessage(msg, "*"); }

function sendRequest(method, params) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
  });
}

function sendNotification(method, params) {
  send({ jsonrpc: "2.0", method, params });
}

window.addEventListener("message", function(event) {
  const msg = event.data;
  if (!msg || msg.jsonrpc !== "2.0") return;

  if ("id" in msg && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
    return;
  }

  if (msg.method === "ui/notifications/sandbox-proxy-ready") {
    sendNotification("ui/notifications/sandbox-resource-ready", {
      html: document.documentElement.outerHTML,
    });
    return;
  }

  if (msg.method === "ui/notifications/tool-result") {
    handleToolResult(msg.params);
  }
});

function handleToolResult(params) {
  const candidates = [params?.result?.content, params?.content];
  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const tb = content.find(c => c.type === "text");
    if (!tb?.text) continue;
    try {
      const data = JSON.parse(tb.text);
      if (data.view && data.data !== undefined) {
        document.getElementById("root").innerHTML =
          "<h3>" + data.view + "</h3><pre>" + JSON.stringify(data.data, null, 2) + "</pre>";
        sendNotification("ui/notifications/size-changed", {
          width: document.body.scrollWidth,
          height: document.body.scrollHeight,
        });
        return;
      }
    } catch {}
  }
}

async function init() {
  try {
    await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      appCapabilities: {},
      appInfo: { name: "KitStack DevKit Shell", version: "1.0.0" },
    });
    sendNotification("ui/notifications/initialized");
  } catch (e) {
    console.error("Init failed:", e);
  }
}

init();
</script>
</body>
</html>`;
}
