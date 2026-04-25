/**
 * Token storage for the KitStack CLI.
 *
 * Credentials are stored at `~/.kitstack/credentials.json` with file
 * permissions `0600` (owner read/write only). The file contains an opaque
 * token (prefixed `kst_`), the authenticated email, and a timestamp.
 *
 * @example
 * ```typescript
 * import { loadCredentials, saveCredentials } from "../credentials";
 *
 * // After login:
 * await saveCredentials({
 *   token: "kst_abc123...",
 *   email: "dev@example.com",
 *   authenticatedAt: new Date().toISOString(),
 * });
 *
 * // Before relay or publish:
 * const creds = loadCredentials();
 * if (!creds) {
 *   console.error("Not logged in. Run: kitstack login");
 *   process.exit(1);
 * }
 * ```
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Credentials {
  token: string;
  email: string;
  authenticatedAt: string;
}

const KITSTACK_DIR = join(homedir(), ".kitstack");
const CREDENTIALS_PATH = join(KITSTACK_DIR, "credentials.json");

/**
 * Load saved credentials from `~/.kitstack/credentials.json`.
 *
 * Returns `null` if the file doesn't exist or is malformed.
 * Does not validate the token against the server — that happens
 * at use time (relay connect, publish).
 */
export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    const raw = readFileSync(CREDENTIALS_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (!data.token || !data.email) return null;
    return data as Credentials;
  } catch {
    return null;
  }
}

/**
 * Save credentials to `~/.kitstack/credentials.json`.
 *
 * Creates the `~/.kitstack/` directory if it doesn't exist.
 * Sets file permissions to `0600` (owner read/write only) to protect
 * the token from other users on shared systems.
 */
export function saveCredentials(credentials: Credentials): void {
  mkdirSync(KITSTACK_DIR, { recursive: true });
  writeFileSync(
    CREDENTIALS_PATH,
    JSON.stringify(credentials, null, 2) + "\n",
    { mode: 0o600 }
  );
  // Ensure permissions on existing files too
  chmodSync(CREDENTIALS_PATH, 0o600);
}

/**
 * Delete saved credentials. Used by a future `kitstack logout` command.
 */
export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) {
    writeFileSync(CREDENTIALS_PATH, "{}\n", { mode: 0o600 });
  }
}
