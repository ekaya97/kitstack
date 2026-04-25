/**
 * Generates a per-kit app shell HTML.
 * The shell handles MCP Apps protocol (postMessage, sandbox handshake, ui/initialize)
 * and loads view modules from CDN. Kit-specific config is baked in at build time.
 */

interface ShellConfig {
  kitId: string;
  platformCdn: string;
  kitCdn: string;
  views: Array<{ slug: string; height?: number }>;
}

export function generateShell(config: ShellConfig): string {
  const viewsJson = JSON.stringify(
    Object.fromEntries(config.views.map((v) => [v.slug, { height: v.height ?? 400 }]))
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #171512; background: #faf7f1; }
  .ks-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #6b6357; }
  .ks-error { padding: 16px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }
  .ks-empty { padding: 24px; text-align: center; color: #6b6357; }
  .ks-list-item { padding: 2px 0 2px 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #d9ceb8; color: #6b6357; font-weight: 500; }
  td { padding: 6px 8px; border-bottom: 1px solid #ece3d1; }
  h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; }
  h4 { font-size: 14px; font-weight: 600; margin: 12px 0 6px; }
  h5 { font-size: 13px; font-weight: 600; margin: 8px 0 4px; color: #6b6357; }
  p { margin: 4px 0; }
  code { background: #ece3d1; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  strong { font-weight: 600; }
</style>
</head>
<body>
<div id="root"><div class="ks-loading">Loading...</div></div>
<script type="module">
// ── Kit config (baked at build time) ──────────────────────────
const KIT_ID = ${JSON.stringify(config.kitId)};
const CDN = ${JSON.stringify(config.platformCdn)};
const KIT_CDN = ${JSON.stringify(config.kitCdn)};
const VIEWS = ${viewsJson};

// ── postMessage transport ─────────────────────────────────────
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

// ── Message handler ───────────────────────────────────────────
const hostCaps = { downloadFile: false, openLinks: false, clipboardWrite: false };

window.addEventListener("message", (event) => {
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
    if (!window.__ks_proxy_ready_sent__) {
      window.__ks_proxy_ready_sent__ = true;
      sendNotification("ui/notifications/sandbox-resource-ready", {
        html: document.documentElement.outerHTML,
      });
    }
    return;
  }

  if (msg.method === "ui/notifications/tool-result" || msg.method === "ui/notifications/tool-input") {
    handleToolResult(msg.params);
  }
});

// ── ui/initialize ─────────────────────────────────────────────
async function init() {
  try {
    const result = await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      appCapabilities: {},
      appInfo: { name: "KitStack", version: "1.0.0" },
    });
    const caps = result?.hostCapabilities ?? {};
    hostCaps.downloadFile = !!caps.downloadFile;
    hostCaps.openLinks = !!caps.openLinks;
    hostCaps.clipboardWrite = true;
    sendNotification("ui/notifications/initialized");
  } catch (e) {
    console.error("[KitStack] Init failed:", e);
  }
}

// ── Tool result handler ───────────────────────────────────────
function handleToolResult(params) {
  const candidates = [params?.result?.content, params?.content];
  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const tb = content.find((c) => c.type === "text");
    if (!tb?.text) continue;
    try {
      const data = JSON.parse(tb.text);
      if (data.view) { loadView(data); return; }
    } catch {}
  }
}

// ── Asset loading helpers ─────────────────────────────────────
const loadedScripts = new Set();

function loadScript(url) {
  if (loadedScripts.has(url)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    script.onload = () => { loadedScripts.add(url); resolve(); };
    script.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(script);
  });
}

function loadCSS(url) {
  if (document.querySelector('link[href="' + url + '"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

// ── View loading ──────────────────────────────────────────────
async function loadView(data) {
  const root = document.getElementById("root");
  root.innerHTML = '<div class="ks-loading">Loading...</div>';

  if (!KIT_CDN) {
    await loadViewMarkdown(data);
    return;
  }

  try {
    // Set up MCP bridge
    window.__KITSTACK_MCP__ = {
      callTool: (cmd, params) =>
        sendRequest("tools/call", { name: "kit", arguments: { id: KIT_ID, cmd, params } }),
      kit: KIT_ID,
      view: data.view,
      capabilities: { ...hostCaps },
      downloadFile: (filename, mimeType, content) =>
        sendRequest("ui/download-file", {
          contents: [{ type: "resource", resource: { uri: "file:///" + filename, mimeType, text: content } }],
        }),
      openLink: (url) => sendRequest("ui/open-link", { url }),
      copyToClipboard: (text) => navigator.clipboard.writeText(text),
    };

    // Debug: show data status BEFORE loading scripts
    const key = KIT_ID + "/" + data.view;
    const debugInfo = "key=" + key + " hasData=" + (data.data != null) + " type=" + typeof data.data + " isArr=" + Array.isArray(data.data) + (Array.isArray(data.data) ? " len=" + data.data.length : "");
    root.innerHTML = '<div style="font-size:11px;color:#999;padding:4px;border-bottom:1px solid #eee;margin-bottom:4px">' + debugInfo + '</div><div id="ks-content"><div class="ks-loading">Loading view...</div></div>';

    // Load assets
    loadCSS(KIT_CDN + "/style.css");
    await loadScript(CDN + "/vendor.js");
    await loadScript(CDN + "/shared.js");
    await loadScript(KIT_CDN + "/" + data.view + ".js");

    // Mount with pre-loaded data from the loader (embedded in tool result by the router)
    const views = window.__KITSTACK_VIEWS__;

    if (views?.[key]) {
      const container = document.getElementById("ks-content");
      views[key].mount(container, data.data);

      requestAnimationFrame(() => {
        const viewCfg = VIEWS[data.view] || {};
        sendNotification("ui/notifications/size-changed", {
          width: document.body.scrollWidth,
          height: Math.max(document.body.scrollHeight, viewCfg.height || 400),
        });
      });
    }
  } catch (err) {
    console.error("[KitStack] View load failed:", err);
    await loadViewMarkdown(data);
  }
}

// ── Markdown fallback ─────────────────────────────────────────
async function loadViewMarkdown(data) {
  const root = document.getElementById("root");
  try {
    const cmd = data.cmd || "list";
    const result = await sendRequest("tools/call", {
      name: "kit",
      arguments: { id: KIT_ID, cmd, params: data.params || {} },
    });
    let text = "";
    if (Array.isArray(result?.content)) {
      const tb = result.content.find((c) => c.type === "text");
      if (tb) text = tb.text;
    }
    root.innerHTML = renderMarkdown(text);
  } catch (err) {
    root.innerHTML = '<div class="ks-error">' + esc(err.message || String(err)) + '</div>';
  }
}

function renderMarkdown(text) {
  const lines = text.split("\\n");
  let html = "";
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("# ")) { ct(); html += "<h3>" + esc(t.slice(2)) + "</h3>"; continue; }
    if (t.startsWith("## ")) { ct(); html += "<h4>" + esc(t.slice(3)) + "</h4>"; continue; }
    if (t.startsWith("### ")) { ct(); html += "<h5>" + esc(t.slice(4)) + "</h5>"; continue; }
    if (t.startsWith("**") && t.includes(":**")) {
      const i = t.indexOf(":**");
      html += "<p><strong>" + esc(t.slice(2, i)) + ":</strong> " + esc(t.slice(i + 3)) + "</p>";
      continue;
    }
    if (t.startsWith("**") && t.endsWith("**") && !t.includes("|")) {
      html += "<p><strong>" + esc(t.slice(2, -2)) + "</strong></p>";
      continue;
    }
    if (t.startsWith("|") && t.endsWith("|")) {
      const cells = t.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) {
        html += "<table><thead><tr>" + cells.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>";
        inTable = true;
        continue;
      }
      html += "<tr>" + cells.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>";
      continue;
    }
    if (inTable && !t.startsWith("|")) ct();
    if (t.startsWith("- ")) { html += '<p class="ks-list-item">' + esc(t.slice(2)) + "</p>"; continue; }
    if (t) html += "<p>" + esc(t) + "</p>";
  }
  ct();
  return html || '<div class="ks-empty">No data yet.</div>';
  function ct() { if (inTable) { html += "</tbody></table>"; inTable = false; } }
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
}

init();
</script>
</body>
</html>`;
}
