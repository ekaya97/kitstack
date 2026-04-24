// Minimal MCP Apps client — implements the sandbox proxy handshake
// and tool result protocol without the full ext-apps SDK.

const root = document.getElementById("root")!;
let requestId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

function send(msg: Record<string, unknown>) {
  window.parent.postMessage(msg, "*");
}

function sendRequest(method: string, params?: Record<string, unknown>): Promise<any> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
  });
}

function sendNotification(method: string, params?: Record<string, unknown>) {
  send({ jsonrpc: "2.0", method, params });
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.jsonrpc !== "2.0") return;

  // Response to a request we sent
  if ("id" in msg && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)!;
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
    return;
  }

  // Sandbox proxy handshake — the proxy sends this when it's ready
  if (msg.method === "ui/notifications/sandbox-proxy-ready") {
    // Respond with the resource ready signal containing our HTML
    sendNotification("ui/notifications/sandbox-resource-ready", {
      html: document.documentElement.outerHTML,
    });
    return;
  }

  // Tool result from the host
  if (msg.method === "ui/notifications/tool-result") {
    handleToolResult(msg.params);
  }
  if (msg.method === "ui/notifications/tool-input") {
    handleToolResult(msg.params);
  }
});

// Initialize the MCP Apps connection
async function init() {
  try {
    await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      appCapabilities: {},
      appInfo: { name: "KitStack", version: "1.0.0" },
    });
    sendNotification("ui/notifications/initialized");
  } catch (e) {
    console.error("[KitStack] Init failed:", e);
  }
}

// --- Tool result handler ---

function handleToolResult(params: any) {
  const candidates = [
    params?.result?.content,
    params?.content,
  ];

  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const textBlock = content.find((c: any) => c.type === "text");
    if (!textBlock?.text) continue;

    try {
      const data = JSON.parse(textBlock.text);
      if (data.kit && data.view && data.cmd) {
        loadView(data);
        return;
      }
    } catch {}
  }
}

// --- View loading ---

interface ViewData {
  kit: string;
  view: string;
  cmd: string;
  params?: Record<string, unknown>;
  app?: string;
}

async function loadView(data: ViewData) {
  const title = data.app || data.view.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  root.innerHTML = `
    <div class="ks-shell">
      <div class="ks-header">
        <h2>${esc(title)}</h2>
        <button onclick="window.__ksRefresh()" class="ks-btn">Refresh</button>
      </div>
      <div id="ks-content" class="ks-loading">Loading...</div>
    </div>
  `;
  (window as any).__ksRefresh = () => loadView(data);

  try {
    const result = await sendRequest("tools/call", {
      name: "kit",
      arguments: { id: data.kit, cmd: data.cmd, params: data.params || {} },
    });

    let text = "";
    const content = result?.content;
    if (Array.isArray(content)) {
      const tb = content.find((c: any) => c.type === "text");
      if (tb) text = tb.text;
    }

    getEl("ks-content").innerHTML = renderMarkdown(text);
    getEl("ks-content").className = "";
  } catch (err: any) {
    getEl("ks-content").innerHTML = `<div class="ks-error">${esc(err.message || String(err))}</div>`;
    getEl("ks-content").className = "";
  }
}

// --- Markdown -> HTML ---

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  let html = "";
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("# ")) { ct(); html += `<h3>${esc(t.slice(2))}</h3>`; continue; }
    if (t.startsWith("## ")) { ct(); html += `<h4>${esc(t.slice(3))}</h4>`; continue; }
    if (t.startsWith("### ")) { ct(); html += `<h5>${esc(t.slice(4))}</h5>`; continue; }
    if (t.startsWith("**") && t.includes(":**")) { const i = t.indexOf(":**"); html += `<p><strong>${esc(t.slice(2, i))}:</strong> ${esc(t.slice(i + 3))}</p>`; continue; }
    if (t.startsWith("**") && t.endsWith("**") && !t.includes("|")) { html += `<p><strong>${esc(t.slice(2, -2))}</strong></p>`; continue; }
    if (t.startsWith("|") && t.endsWith("|")) {
      const cells = t.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) { html += `<table><thead><tr>${cells.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`; inTable = true; continue; }
      html += `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`; continue;
    }
    if (inTable && !t.startsWith("|")) ct();
    if (t.startsWith("*") && t.endsWith("*") && !t.startsWith("**")) { html += `<p class="ks-muted">${esc(t.slice(1, -1))}</p>`; continue; }
    if (t.startsWith("- ")) { html += `<p class="ks-list-item">${esc(t.slice(2))}</p>`; continue; }
    if (t) html += `<p>${esc(t)}</p>`;
  }
  ct();
  return html || `<div class="ks-empty">No data yet.</div>`;
  function ct() { if (inTable) { html += "</tbody></table>"; inTable = false; } }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/`([^`]+)`/g, "<code>$1</code>");
}

function getEl(id: string): HTMLElement {
  return document.getElementById(id)!;
}

init();
