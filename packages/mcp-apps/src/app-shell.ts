// Minimal MCP Apps client (7KB) — handles sandbox handshake, loads React views from CDN.

const root = document.getElementById("root")!;
let requestId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

// CDN base URL — set at build time via env var, baked into the bundle
const CDN_BASE = import.meta.env.VITE_CDN_URL || "";

// Kit folder mapping
const KIT_FOLDER: Record<string, string> = {
  crm: "crm",
  "cold-outreach": "outreach",
  "expense-tax-prep": "expense",
  "meeting-action-tracker": "meeting",
};

// --- postMessage transport ---

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

  if (msg.method === "ui/notifications/sandbox-proxy-ready") {
    if (!(window as any).__ks_proxy_ready_sent__) {
      (window as any).__ks_proxy_ready_sent__ = true;
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

// Host capabilities — populated from ui/initialize response
const hostCaps: Record<string, boolean> = {
  downloadFile: false,
  openLinks: false,
  clipboardWrite: false,
};

async function init() {
  try {
    const result = await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      appCapabilities: {},
      appInfo: { name: "KitStack", version: "1.0.0" },
    });
    // Store host capabilities for feature detection
    const caps = result?.hostCapabilities ?? {};
    hostCaps.downloadFile = !!caps.downloadFile;
    hostCaps.openLinks = !!caps.openLinks;
    hostCaps.clipboardWrite = true; // clipboard is always attempted, permission checked at use time
    sendNotification("ui/notifications/initialized");
  } catch (e) {
    console.error("[KitStack] Init failed:", e);
  }
}

// --- Tool result handler ---

function handleToolResult(params: any) {
  const candidates = [params?.result?.content, params?.content];
  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const tb = content.find((c: any) => c.type === "text");
    if (!tb?.text) continue;
    try {
      const data = JSON.parse(tb.text);
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
  cdn?: string;
  data?: unknown;
}

const loadedScripts = new Set<string>();

function loadScript(url: string): Promise<void> {
  if (loadedScripts.has(url)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    script.onload = () => { loadedScripts.add(url); resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

function loadCSS(url: string) {
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

async function loadView(data: ViewData) {
  const folder = KIT_FOLDER[data.kit];

  root.innerHTML = `
    <div class="ks-shell">
      <div id="ks-content" class="ks-loading">Loading...</div>
    </div>
  `;

  const cdn = CDN_BASE;
  if (!cdn || !folder) {
    // No CDN configured — fall back to markdown rendering via MCP
    await loadViewMarkdown(data);
    return;
  }

  try {
    // Get a JWT token for the app-data Lambda via MCP channel (stays inside iframe, never reaches LLM)
    const tokenResult = await sendRequest("tools/call", {
      name: "kit",
      arguments: { id: data.kit, cmd: "get_app_token", params: {} },
    });
    const tokenText = tokenResult?.content?.find?.((c: any) => c.type === "text")?.text;
    if (tokenText) {
      const tokenData = JSON.parse(tokenText);
      (window as any).__KITSTACK__ = {
        token: tokenData.token,
        appDataUrl: tokenData.appDataUrl,
        kit: tokenData.kit,
      };
    }

    // Set up the MCP bridge for React views — includes file operations
    (window as any).__KITSTACK_MCP__ = {
      callTool: (cmd: string, params: Record<string, unknown>) =>
        sendRequest("tools/call", {
          name: "kit",
          arguments: { id: data.kit, cmd, params },
        }),
      kit: data.kit,
      view: data.view,
      capabilities: { ...hostCaps },

      downloadFile: (filename: string, mimeType: string, content: string) =>
        sendRequest("ui/download-file", {
          contents: [{
            type: "resource",
            resource: { uri: `file:///${filename}`, mimeType, text: content },
          }],
        }),

      openLink: (url: string) =>
        sendRequest("ui/open-link", { url }),

      copyToClipboard: (text: string) =>
        navigator.clipboard.writeText(text),
    };
    // Load shared CSS
    loadCSS(`${cdn}/style.css`);

    // Load vendor (React) + shared chunks, then view module
    await loadScript(`${cdn}/vendor.js`);
    await loadScript(`${cdn}/shared.js`);
    await loadScript(`${cdn}/${folder}/${data.view}.js`);

    // The view module should have auto-mounted into #ks-content
    // If it exported mount() via a global registry, call it
    const views = (window as any).__KITSTACK_VIEWS__;
    if (views?.[`${folder}/${data.view}`]) {
      const container = document.getElementById("ks-content")!;
      container.innerHTML = "";
      container.className = "";
      views[`${folder}/${data.view}`].mount(container, data.data);

      // Notify host of content size after render
      requestAnimationFrame(() => {
        const height = document.body.scrollHeight;
        sendNotification("ui/notifications/size-changed", {
          width: document.body.scrollWidth,
          height: Math.max(height, 400),
        });
      });
    }
  } catch (err: any) {
    console.error("[KitStack] View load failed:", err);
    // Fall back to markdown rendering
    await loadViewMarkdown(data);
  }
}

// Markdown fallback — fetch data via MCP tool call and render as formatted text
async function loadViewMarkdown(data: ViewData) {
  try {
    const result = await sendRequest("tools/call", {
      name: "kit",
      arguments: { id: data.kit, cmd: data.cmd, params: data.params || {} },
    });

    let text = "";
    if (Array.isArray(result?.content)) {
      const tb = result.content.find((c: any) => c.type === "text");
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
