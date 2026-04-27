/**
 * Authenticate with KitStack via browser OAuth flow.
 *
 * 1. Starts a temporary HTTP server on localhost (port 9876, or next available).
 * 2. Opens the browser to `https://kitstack.co/cli/authorize?callback=http://localhost:{port}`.
 * 3. User logs in (BetterAuth) and clicks "Authorize".
 * 4. KitStack creates a BetterAuth session (1-year expiry) and redirects
 *    back to localhost with `?token={sessionToken}&email=...`.
 * 5. Saves credentials to `~/.kitstack/credentials.json` (0600 permissions).
 * 6. Prints confirmation and exits. Times out after 2 minutes.
 *
 * The token is a standard BetterAuth session token stored in Turso's
 * `session` table. It can be revoked from the web app's session management.
 *
 * @example
 * ```sh
 * npx kitstack login
 * # Opens browser → user authorizes → "Authenticated as dev@example.com"
 * ```
 *
 * @example Check if already logged in (from kits/crm):
 * ```sh
 * cat ~/.kitstack/credentials.json
 * # { "token": "kst_...", "email": "...", "authenticatedAt": "..." }
 * ```
 */

import { createServer } from "node:http";
import { URL } from "node:url";
import { randomBytes } from "node:crypto";
import { saveCredentials, loadCredentials } from "../credentials";

const KITSTACK_AUTH_URL = process.env.KITSTACK_AUTH_URL || "https://kitstack.co/cli/authorize";
const DEFAULT_PORT = 9876;

export async function login(args: string[]) {
  // Check if already logged in
  const existing = loadCredentials();
  if (existing && !args.includes("--force")) {
    console.log(`\n  Already authenticated as ${existing.email}.`);
    console.log(`  Run \`kitstack login --force\` to re-authenticate.\n`);
    return;
  }

  // Generate CSRF state — verified on callback to prevent cross-site token injection
  const state = randomBytes(16).toString("hex");

  const port = await startCallbackServer(state);

  const callbackUrl = `http://localhost:${port}`;
  const authUrl = `${KITSTACK_AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}&state=${state}`;

  console.log(`\n  Opening browser to authenticate with KitStack...`);
  console.log(`  If the browser doesn't open, visit:\n  ${authUrl}\n`);

  // Open browser
  await openBrowser(authUrl);

  console.log("  Waiting for authorization (2 minutes)...");

  // Timeout after 2 minutes
  setTimeout(() => {
    console.error("\n  Login timed out. Try again with: kitstack login\n");
    process.exit(1);
  }, 120_000);
}

function startCallbackServer(expectedState: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      // CORS headers for browser POST from kitstack.co
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      // Read POST body
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        let data: { token?: string; email?: string; state?: string; error?: string };
        try {
          data = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        if (data.error) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          console.error(`\n  Authorization failed: ${data.error}\n`);
          server.close();
          process.exit(1);
        }

        if (!data.token || !data.email) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing token or email" }));
          return;
        }

        // Verify CSRF state
        if (data.state !== expectedState) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "State mismatch" }));
          console.error("\n  Authorization rejected: state parameter mismatch.\n");
          server.close();
          process.exit(1);
        }

        // Save credentials
        saveCredentials({
          token: data.token,
          email: data.email,
          authenticatedAt: new Date().toISOString(),
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));

        console.log(`\n  Authenticated as ${data.email}.`);
        console.log(`  Token saved to ~/.kitstack/credentials.json\n`);

        server.close();
        process.exit(0);
      });
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Try next port
        server.listen(0, "127.0.0.1");
      } else {
        reject(err);
      }
    });

    server.listen(DEFAULT_PORT, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : DEFAULT_PORT;
      resolve(port);
    });
  });
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import("node:child_process");
  const platform = process.platform;

  const cmd =
    platform === "darwin" ? `open "${url}"` :
    platform === "win32" ? `start "" "${url}"` :
    `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      // Browser open failed silently — user can copy the URL from the terminal
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KitStack CLI — ${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #faf7f1; color: #171512; }
    .card { text-align: center; padding: 2rem; max-width: 400px; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    p { color: #6b6357; line-height: 1.6; }
    strong { color: #171512; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;
}
