/**
 * Turso Database Provisioner (web-local, HTTP-only)
 *
 * Creates and destroys per-user kit databases via the Turso Platform API.
 * Runs migrations via Turso's HTTP pipeline endpoint — no native libsql binary needed.
 */

import { putUserKitDb } from "@kitstackco/mcp-server/framework/dynamo";

const TURSO_API_BASE = "https://api.turso.tech/v1";

function getTursoConfig() {
  const token = process.env.TURSO_PLATFORM_API_TOKEN;
  const org = process.env.TURSO_ORG_NAME;
  if (!token || !org) {
    throw new Error("TURSO_PLATFORM_API_TOKEN and TURSO_ORG_NAME must be set");
  }
  return { token, org };
}

async function tursoFetch(path: string, options: RequestInit = {}) {
  const { token } = getTursoConfig();
  const res = await fetch(`${TURSO_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Turso API error (${res.status}): ${body}`);
  }
  return res.json();
}

async function runMigrations(dbHostname: string, dbToken: string, migrationSql: string) {
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const requests = [
    ...statements.map((sql) => ({ type: "execute", stmt: { sql } })),
    { type: "close" },
  ];

  const res = await fetch(`https://${dbHostname}/v3/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dbToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Turso pipeline error (${res.status}): ${body}`);
  }
}

export async function provisionKitDatabase(
  userId: string,
  kitId: string,
  migrationSql: string,
): Promise<{ dbUrl: string; dbToken: string }> {
  const { org } = getTursoConfig();
  const dbName = `ks-${userId}-${kitId}`.replace(/[^a-z0-9-]/g, "-");

  const createResult = await tursoFetch(`/organizations/${org}/databases`, {
    method: "POST",
    body: JSON.stringify({ name: dbName, group: "default" }),
  });

  const hostname = createResult.database?.hostname;
  if (!hostname) throw new Error("Failed to get database hostname from Turso");
  const dbUrl = `libsql://${hostname}`;

  const tokenResult = await tursoFetch(
    `/organizations/${org}/databases/${dbName}/auth/tokens`,
    { method: "POST", body: JSON.stringify({ permissions: { read_attach: { databases: ["*"] } } }) },
  );

  const dbToken = tokenResult.jwt;
  if (!dbToken) throw new Error("Failed to get database token from Turso");

  await runMigrations(hostname, dbToken, migrationSql);

  await putUserKitDb({
    userId,
    kitId,
    dbUrl,
    dbToken,
    provisionedAt: new Date().toISOString(),
  });

  return { dbUrl, dbToken };
}

export async function destroyKitDatabase(
  userId: string,
  kitId: string,
): Promise<void> {
  const { org } = getTursoConfig();
  const dbName = `ks-${userId}-${kitId}`.replace(/[^a-z0-9-]/g, "-");
  await tursoFetch(`/organizations/${org}/databases/${dbName}`, {
    method: "DELETE",
  });
}
