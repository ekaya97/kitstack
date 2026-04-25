/**
 * Authenticate with KitStack via browser OAuth flow.
 *
 * 1. Starts a temporary HTTP server on localhost (port 9876, or next available).
 * 2. Opens the browser to `https://kitstack.co/cli/authorize?callback=http://localhost:{port}`.
 * 3. User logs in (BetterAuth) and clicks "Authorize".
 * 4. KitStack redirects back to localhost with `?token=kst_...&email=...`.
 * 5. Saves credentials to `~/.kitstack/credentials.json` (0600 permissions).
 * 6. Prints confirmation and exits.
 *
 * The token is opaque (not JWT), prefixed with `kst_`, and revocable from
 * the KitStack dashboard. No expiration by default.
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

  const port = await startCallbackServer();

  const callbackUrl = `http://localhost:${port}`;
  const authUrl = `${KITSTACK_AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}`;

  console.log(`\n  Opening browser to authenticate with KitStack...`);
  console.log(`  If the browser doesn't open, visit:\n  ${authUrl}\n`);

  // Open browser
  await openBrowser(authUrl);

  console.log("  Waiting for authorization...");
}

function startCallbackServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost`);

      // Handle the callback from KitStack
      const token = url.searchParams.get("token");
      const email = url.searchParams.get("email");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(htmlPage("Authorization Failed", `<p>Error: ${escapeHtml(error)}</p><p>You can close this tab.</p>`));
        console.error(`\n  Authorization failed: ${error}\n`);
        server.close();
        process.exit(1);
      }

      if (!token || !email) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(htmlPage("Missing Parameters", "<p>Missing token or email. Try again.</p>"));
        return;
      }

      // Save credentials
      saveCredentials({
        token,
        email,
        authenticatedAt: new Date().toISOString(),
      });

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage("Authenticated!", `<p>Authenticated as <strong>${escapeHtml(email)}</strong>.</p><p>You can close this tab and return to the terminal.</p>`));

      console.log(`\n  Authenticated as ${email}.`);
      console.log(`  Token saved to ~/.kitstack/credentials.json\n`);

      server.close();
      process.exit(0);
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
