import { putUserKitDb } from "./dynamo";
import { Resource } from "sst";
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const TURSO_API_BASE = "https://api.turso.tech/v1";

function isDevMode(): boolean {
  return (Resource as any).App?.stage === "dev" || !!(Resource as any).App?.local;
}

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

async function runMigrations(dbUrl: string, dbToken: string, migrationSql: string) {
  const client = createClient({ url: dbUrl, authToken: dbToken || undefined });
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await client.execute(stmt);
  }
}

async function provisionLocal(
  userId: string,
  kitId: string,
  migrationSql: string
): Promise<{ dbUrl: string; dbToken: string }> {
  const dbDir = resolve(process.cwd(), "databases");
  mkdirSync(dbDir, { recursive: true });

  const dbName = `ks-${userId}-${kitId}`.replace(/[^a-z0-9-]/g, "-");
  const dbUrl = `file:${resolve(dbDir, `${dbName}.db`)}`;

  await runMigrations(dbUrl, "", migrationSql);

  return { dbUrl, dbToken: "" };
}

async function provisionTurso(
  userId: string,
  kitId: string,
  migrationSql: string
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
    { method: "POST", body: JSON.stringify({ permissions: { read_attach: { databases: [dbName] } } }) }
  );

  const dbToken = tokenResult.jwt;
  if (!dbToken) throw new Error("Failed to get database token from Turso");

  await runMigrations(dbUrl, dbToken, migrationSql);

  return { dbUrl, dbToken };
}

export async function provisionKitDatabase(
  userId: string,
  kitId: string,
  migrationSql: string
): Promise<{ dbUrl: string; dbToken: string }> {
  const { dbUrl, dbToken } = isDevMode()
    ? await provisionLocal(userId, kitId, migrationSql)
    : await provisionTurso(userId, kitId, migrationSql);

  await putUserKitDb({
    userId,
    kitId,
    dbUrl,
    dbToken,
    provisionedAt: new Date().toISOString(),
    status: "active",
  });

  return { dbUrl, dbToken };
}
