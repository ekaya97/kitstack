import { putUserKitDb } from "./dynamo";

const TURSO_API_BASE = "https://api.turso.tech/v1";

function getConfig() {
  const token = process.env.TURSO_PLATFORM_API_TOKEN;
  const org = process.env.TURSO_ORG_NAME;
  if (!token || !org) {
    throw new Error("TURSO_PLATFORM_API_TOKEN and TURSO_ORG_NAME must be set");
  }
  return { token, org };
}

async function tursoFetch(path: string, options: RequestInit = {}) {
  const { token } = getConfig();
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

export async function provisionKitDatabase(
  userId: string,
  kitId: string,
  migrationSql: string
): Promise<{ dbUrl: string; dbToken: string }> {
  const { org } = getConfig();
  const dbName = `ks-${userId}-${kitId}`.replace(/[^a-z0-9-]/g, "-");

  // Create database
  const createResult = await tursoFetch(`/organizations/${org}/databases`, {
    method: "POST",
    body: JSON.stringify({
      name: dbName,
      group: "default",
    }),
  });

  const hostname = createResult.database?.hostname;
  if (!hostname) {
    throw new Error("Failed to get database hostname from Turso");
  }

  const dbUrl = `libsql://${hostname}`;

  // Create auth token for the database
  const tokenResult = await tursoFetch(
    `/organizations/${org}/databases/${dbName}/auth/tokens`,
    {
      method: "POST",
      body: JSON.stringify({ permissions: { read_attach: { databases: ["*"] } } }),
    }
  );

  const dbToken = tokenResult.jwt;
  if (!dbToken) {
    throw new Error("Failed to get database token from Turso");
  }

  // Run migrations
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: dbUrl, authToken: dbToken });
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await client.execute(stmt);
  }

  // Store mapping in DynamoDB
  await putUserKitDb({
    userId,
    kitId,
    dbUrl,
    dbToken,
    provisionedAt: new Date().toISOString(),
  });

  return { dbUrl, dbToken };
}
