/**
 * DevKit HTTP server with Vite dev server for view HMR.
 *
 * Endpoints:
 *   GET  /                        → DevKit host page (app.html)
 *   GET  /__devkit/shell          → App shell HTML (loads views from Vite)
 *   GET  /__devkit/proxy          → Mock sandbox proxy HTML
 *   GET  /__devkit/loader/:slug   → Execute view loader, return JSON
 *   POST /__devkit/tool           → Execute tool, return KitToolResult
 *
 * Vite dev server runs on port+1 (default 5175), serving view module
 * entry points with React Fast Refresh / HMR.
 */

import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { spawn } from "node:child_process";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitContext } from "../types";
import { generateProxyHtml } from "./proxy";

export interface DevKitServerOptions {
  kit: KitDefinition;
  db: LibSQLDatabase;
  port?: number;
  kitRoot?: string;
}

export async function startDevKitServer(options: DevKitServerOptions): Promise<void> {
  const { kit, db, port = 5174 } = options;
  const vitePort = port + 1;
  const kitRoot = options.kitRoot || process.cwd();
  const ctx: KitContext = { userId: "dev-user", kitId: kit.id };

  const toolMap = new Map(kit.tools.map((t) => [t.name, t]));
  const viewMap = new Map((kit.views ?? []).map((v) => [v.slug, v]));

  // --- Generate Vite entry points for each view ---

  const entryDir = resolve(kitRoot, ".kitstack/devkit-entries");
  mkdirSync(entryDir, { recursive: true });

  for (const view of kit.views ?? []) {
    const viewFile = resolve(kitRoot, "src/views", view.slug, "View.tsx");
    if (!existsSync(viewFile)) continue;

    const relPath = relative(entryDir, viewFile).replace(/\\/g, "/");
    const stylesFile = resolve(kitRoot, "src/views/styles.css");
    const stylesImport = existsSync(stylesFile)
      ? `import "${relative(entryDir, stylesFile).replace(/\\/g, "/")}";\n`
      : "";
    const entry = `${stylesImport}
import React from "react";
import { createRoot } from "react-dom/client";
import * as ViewModule from "${relPath}";

const Component = ViewModule.default || Object.values(ViewModule).find(v => typeof v === "function");

export function mount(container, data) {
  if (!Component) {
    container.innerHTML = "<p>No view component found</p>";
    return;
  }
  createRoot(container).render(React.createElement(Component, { data }));
}

((window).__KITSTACK_VIEWS__ ??= {})["${kit.id}/${view.slug}"] = { mount };
`;
    writeFileSync(resolve(entryDir, `${view.slug}.tsx`), entry);
  }

  // Vite config — root is kit dir so Tailwind/PostCSS configs are found
  const projectRoot = resolve(kitRoot, "../..");
  writeFileSync(resolve(entryDir, "vite.config.ts"), `
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "${kitRoot.replace(/\\/g, "/")}",
  server: { port: ${vitePort}, strictPort: true, cors: true },
  esbuild: { jsx: "automatic" },
  css: {
    postcss: "${entryDir.replace(/\\/g, "/")}",
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "react": resolve("${projectRoot.replace(/\\/g, "/")}", "node_modules/react"),
      "react-dom": resolve("${projectRoot.replace(/\\/g, "/")}", "node_modules/react-dom"),
    },
  },
});
`);

  // PostCSS config in entry dir pointing to the kit's Tailwind config
  const twConfigPath = resolve(kitRoot, "tailwind.config.ts").replace(/\\/g, "/");
  writeFileSync(resolve(entryDir, "postcss.config.cjs"), `
module.exports = {
  plugins: {
    tailwindcss: { config: "${twConfigPath}" },
    autoprefixer: {},
  },
};
`);

  // Index HTML for Vite (must be in the Vite root = kitRoot)
  const entryImports = (kit.views ?? [])
    .map((v) => `<script type="module" src="/.kitstack/devkit-entries/${v.slug}.tsx"></script>`)
    .join("\n    ");
  writeFileSync(resolve(kitRoot, "index.html"), `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><div id="root"></div>${entryImports}</body></html>`);

  // --- Start Vite dev server ---

  const viteProcess = spawn("npx", ["vite", "--config", resolve(entryDir, "vite.config.ts")], {
    cwd: entryDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development" },
  });

  let viteReady = false;
  const onViteOutput = (d: Buffer) => {
    const msg = d.toString();
    if (msg.includes("ready") || msg.includes("Local:")) viteReady = true;
    // Only show Vite errors, not routine output
    if (msg.includes("error") || msg.includes("Error")) {
      process.stderr.write(`  [vite] ${msg}`);
    }
  };
  viteProcess.stdout?.on("data", onViteOutput);
  viteProcess.stderr?.on("data", onViteOutput);

  // Wait for Vite (max 15s)
  await new Promise<void>((res) => {
    const t = setInterval(() => { if (viteReady) { clearInterval(t); res(); } }, 200);
    setTimeout(() => { clearInterval(t); res(); }, 15000);
  });

  // --- DevKit HTTP server ---

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
  const shellHtml = generateDevShellHtml(kit, vitePort);

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(appHtml);
      return;
    }

    if (url.pathname === "/__devkit/shell") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml);
      return;
    }

    if (url.pathname === "/__devkit/proxy") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(proxyHtml);
      return;
    }

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

    // Proxy everything else to Vite dev server (view modules, HMR, etc.)
    try {
      const viteReq = await fetch(`http://localhost:${vitePort}${url.pathname}${url.search}`);
      const contentType = viteReq.headers.get("content-type") || "application/octet-stream";
      res.writeHead(viteReq.status, { "Content-Type": contentType });
      const body = Buffer.from(await viteReq.arrayBuffer());
      res.end(body);
    } catch {
      res.writeHead(502);
      res.end("Vite dev server not reachable");
    }
  });

  httpServer.listen(port, () => {
    process.stderr.write(
      `\n  KitStack View DevKit\n` +
      `  Kit:   ${kit.name} (${kit.tools.length} tools, ${kit.views?.length ?? 0} views)\n` +
      `  UI:    http://localhost:${port}\n` +
      `  Vite:  http://localhost:${vitePort}\n\n`
    );
  });

  process.on("exit", () => viteProcess.kill());
  process.on("SIGINT", () => { viteProcess.kill(); process.exit(0); });

  await new Promise(() => {});
}

function generateDevShellHtml(kit: KitDefinition, vitePort: number): string {
  const viteUrl = `http://localhost:${vitePort}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #171512; background: #faf7f1; }
  .ks-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #6b6357; }
  .ks-error { padding: 16px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }
</style>
</head>
<body>
<div id="root"><div class="ks-loading">Loading view...</div></div>
<script type="module">
const KIT_ID = ${JSON.stringify(kit.id)};
const VITE_URL = ${JSON.stringify(viteUrl)};

let requestId = 0;
const pending = new Map();
let viewMounted = false;

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

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.jsonrpc !== "2.0") return;
  console.log("[shell] received:", msg.method || "response", msg);
  if ("id" in msg && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error); else resolve(msg.result);
    return;
  }
  if (msg.method === "ui/notifications/sandbox-proxy-ready") {
    console.log("[shell] proxy ready, sending resource-ready");
    sendNotification("ui/notifications/sandbox-resource-ready", {
      html: document.documentElement.outerHTML,
    });
    return;
  }
  if (msg.method === "ui/notifications/tool-result" || msg.method === "ui/notifications/tool-input") {
    console.log("[shell] tool-result received, viewMounted:", viewMounted);
    if (!viewMounted) handleToolResult(msg.params);
  }
});

window.__KITSTACK_MCP__ = {
  callTool: (cmd, params) =>
    sendRequest("tools/call", { name: "kit", arguments: { id: KIT_ID, cmd, params } }),
  kit: KIT_ID,
  view: null,
  capabilities: {},
};

function handleToolResult(params) {
  const candidates = [params?.result?.content, params?.content];
  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const tb = content.find(c => c.type === "text");
    if (!tb?.text) continue;
    try {
      const data = JSON.parse(tb.text);
      if (data.view) { loadView(data); return; }
    } catch {}
  }
}

async function loadView(data) {
  const root = document.getElementById("root");
  root.innerHTML = '<div class="ks-loading">Loading view...</div>';
  try {
    window.__KITSTACK_MCP__.view = data.view;
    window.__KITSTACK_DATA__ = data.data;

    const module = await import("/.kitstack/devkit-entries/" + data.view + ".tsx");
    const container = document.createElement("div");
    root.innerHTML = "";
    root.appendChild(container);

    if (module.mount) {
      module.mount(container, data.data);
      viewMounted = true;
      requestAnimationFrame(() => {
        sendNotification("ui/notifications/size-changed", {
          width: document.body.scrollWidth,
          height: Math.max(document.body.scrollHeight, 400),
        });
      });
    }
  } catch (err) {
    root.innerHTML = '<div class="ks-error">View load failed: ' + err.message + '</div>';
  }
}

async function init() {
  console.log("[shell] init starting");
  try {
    const result = await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      appCapabilities: {},
      appInfo: { name: "KitStack DevKit", version: "1.0.0" },
    });
    console.log("[shell] init result:", result);
    sendNotification("ui/notifications/initialized");
    console.log("[shell] sent notifications/initialized");
  } catch (e) {
    console.error("[shell] Init failed:", e);
  }
}

console.log("[shell] loaded, calling init");


init();
</script>
</body>
</html>`;
}
