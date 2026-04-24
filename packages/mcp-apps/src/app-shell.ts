// Minimal MCP Apps postMessage client — no SDK dependency.
// Generic renderer: receives {kit, view, cmd, params} from the server,
// calls the tool via MCP channel, renders the markdown result.
// Ignores all other tool results (write actions, list, describe).

const root = document.getElementById("root")!;
let requestId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

// --- JSON-RPC over postMessage ---

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

  if ("id" in msg && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)!;
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
    return;
  }

  if (msg.method === "ui/notifications/tool-result") {
    handleToolResult(msg.params);
  }
});

// --- Initialize ---

async function init() {
  try {
    await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      capabilities: {},
      clientInfo: { name: "KitStack", version: "1.0.0" },
    });
    sendNotification("ui/notifications/initialized");
  } catch (e) {
    console.error("[KitStack] Init failed:", e);
  }
}

// --- Tool result handler ---

function handleToolResult(params: any) {
  const result = params?.result ?? params;
  const text = result?.content?.find?.((c: any) => c.type === "text")?.text;
  if (!text) return;

  // Only act on structured show_app data: {kit, view, cmd, params}
  try {
    const data = JSON.parse(text);
    if (data.kit && data.view && data.cmd) {
      loadView(data);
    }
  } catch {
    // Not show_app JSON — ignore (write actions, list, describe)
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

let lastView: ViewData | null = null;

async function loadView(data: ViewData) {
  lastView = data;
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

    const text = result?.content?.find?.((c: any) => c.type === "text")?.text || "";
    getEl("ks-content").innerHTML = renderMarkdown(text);
    getEl("ks-content").className = "";
  } catch (err: any) {
    getEl("ks-content").innerHTML = `<div class="ks-error">${esc(err.message || String(err))}</div>`;
    getEl("ks-content").className = "";
  }
}

// --- Markdown → HTML renderer ---

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  let html = "";
  let inTable = false;

  for (const line of lines) {
    const t = line.trim();

    if (t.startsWith("# ")) { closeTable(); html += `<h3>${esc(t.slice(2))}</h3>`; continue; }
    if (t.startsWith("## ")) { closeTable(); html += `<h4>${esc(t.slice(3))}</h4>`; continue; }
    if (t.startsWith("### ")) { closeTable(); html += `<h5>${esc(t.slice(4))}</h5>`; continue; }

    if (t.startsWith("**") && t.includes(":**")) {
      const i = t.indexOf(":**");
      html += `<p><strong>${esc(t.slice(2, i))}:</strong> ${esc(t.slice(i + 3))}</p>`;
      continue;
    }
    if (t.startsWith("**") && t.endsWith("**") && !t.includes("|")) {
      html += `<p><strong>${esc(t.slice(2, -2))}</strong></p>`;
      continue;
    }

    if (t.startsWith("|") && t.endsWith("|")) {
      const cells = t.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) {
        html += `<table><thead><tr>${cells.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`;
        inTable = true;
        continue;
      }
      html += `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
      continue;
    }

    if (inTable && !t.startsWith("|")) closeTable();

    if (t.startsWith("*") && t.endsWith("*") && !t.startsWith("**")) {
      html += `<p class="ks-muted">${esc(t.slice(1, -1))}</p>`; continue;
    }
    if (t.startsWith("- ")) { html += `<p class="ks-list-item">${esc(t.slice(2))}</p>`; continue; }
    if (t) html += `<p>${esc(t)}</p>`;
  }

  closeTable();
  return html || `<div class="ks-empty">No data yet.</div>`;

  function closeTable() {
    if (inTable) { html += "</tbody></table>"; inTable = false; }
  }
}

// --- Helpers ---

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/`([^`]+)`/g, "<code>$1</code>");
}

function getEl(id: string): HTMLElement {
  return document.getElementById(id)!;
}

init();
