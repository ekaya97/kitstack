/**
 * Admin script: remove a deployed kit from the KitStack platform.
 *
 * Archives per-user databases to S3 before destroying them, then cleans
 * all platform state: Lambda, S3 artifacts, DynamoDB, Turso registry.
 *
 * Run via:
 *   npx sst shell --stage production -- npx tsx scripts/remove-kit.ts <kitId>
 *   npx sst shell --stage production -- npx tsx scripts/remove-kit.ts crm --dry-run
 *   npx sst shell --stage production -- npx tsx scripts/remove-kit.ts crm --force
 *
 * @module
 */

import { createInterface } from "node:readline";
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  LambdaClient,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  CloudWatchLogsClient,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { createClient } from "@libsql/client";
import { Resource } from "sst";

// ── Config ──────────────────────────────────────────────────────

const REGION = "eu-central-1";
const TURSO_API_BASE = "https://api.turso.tech/v1";

const dynamo = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });
const logs = new CloudWatchLogsClient({ region: REGION });

// ── Helpers ─────────────────────────────────────────────────────

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function info(msg: string) { console.log(`  · ${msg}`); }
function warn(msg: string) { console.warn(`  ⚠ ${msg}`); }
function fail(msg: string) { console.error(`  ✗ ${msg}`); }

let failures = 0;

function warnOrFail(msg: string) {
  warn(msg);
  failures++;
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`\n${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

function tursoConfig() {
  return {
    token: (Resource as any).TursoPlatformApiToken.value as string,
    org: (Resource as any).TursoOrgName.value as string,
  };
}

async function tursoFetch(path: string, options: RequestInit = {}): Promise<any> {
  const { token } = tursoConfig();
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
    throw new Error(`Turso API ${res.status}: ${body}`);
  }
  return res.json();
}

function sanitizeDbName(userId: string, kitId: string): string {
  return `ks-${userId}-${kitId}`.replace(/[^a-z0-9-]/g, "-");
}

// ── Types ───────────────────────────────────────────────────────

interface UserKitDbItem {
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
  provisionedAt?: string;
  status?: string;
}

// ── Step 1: Discover affected users ─────────────────────────────

async function findUserDbs(kitId: string): Promise<UserKitDbItem[]> {
  const tableName = (Resource as any).UserKitDbs.name;
  const items: UserKitDbItem[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "kitId = :kitId",
        ExpressionAttributeValues: marshall({ ":kitId": kitId }),
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of result.Items || []) {
      items.push(unmarshall(item) as UserKitDbItem);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// ── Step 3: Archive per-user Turso DBs to S3 ───────────────────

async function dumpDatabase(dbUrl: string, dbToken: string): Promise<string> {
  const client = createClient({ url: dbUrl, authToken: dbToken });
  const lines: string[] = [];

  try {
    // Get table definitions
    const tables = await client.execute(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"
    );

    for (const row of tables.rows) {
      const tableName = row.name as string;
      const createSql = row.sql as string;

      // Skip internal tables
      if (tableName.startsWith("_") || tableName.startsWith("sqlite_")) continue;

      lines.push(`-- Table: ${tableName}`);
      lines.push(`${createSql};`);
      lines.push("");

      // Dump rows
      const data = await client.execute(`SELECT * FROM "${tableName}"`);
      for (const dataRow of data.rows) {
        const columns = Object.keys(dataRow);
        const values = columns.map((col) => {
          const val = (dataRow as any)[col];
          if (val === null) return "NULL";
          if (typeof val === "number") return String(val);
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        lines.push(
          `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});`
        );
      }
      lines.push("");
    }
  } finally {
    client.close();
  }

  return lines.join("\n");
}

async function mintFreshToken(dbName: string): Promise<string> {
  const { org } = tursoConfig();
  const result = await tursoFetch(
    `/organizations/${org}/databases/${dbName}/auth/tokens`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return result.jwt;
}

async function archiveUserDbs(
  kitId: string,
  userDbs: UserKitDbItem[],
  dryRun: boolean
): Promise<number> {
  const bucketName = (Resource as any).KitAssets.name;
  let archived = 0;

  for (const entry of userDbs) {
    const dbName = sanitizeDbName(entry.userId, kitId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const s3Key = `archives/kits/${kitId}/${entry.userId}/${dbName}-${timestamp}.sql`;

    if (dryRun) {
      info(`[DRY RUN] Would archive ${dbName} → s3://${bucketName}/${s3Key}`);
      archived++;
      continue;
    }

    try {
      // Try with stored token first, fall back to fresh token
      let dump: string;
      try {
        dump = await dumpDatabase(entry.dbUrl, entry.dbToken);
      } catch {
        info(`Stored token expired for ${dbName}, minting fresh token...`);
        const freshToken = await mintFreshToken(dbName);
        dump = await dumpDatabase(entry.dbUrl, freshToken);
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: dump,
          ContentType: "text/plain",
        })
      );
      pass(`Archived ${dbName} (${(dump.length / 1024).toFixed(1)} KB) → ${s3Key}`);
      archived++;
    } catch (err: any) {
      warnOrFail(`Failed to archive ${dbName}: ${err.message}`);
    }
  }

  return archived;
}

// ── Step 4: Destroy per-user Turso DBs + DynamoDB ───────────────

async function destroyUserDbs(
  kitId: string,
  userDbs: UserKitDbItem[],
  dryRun: boolean
): Promise<{ destroyed: number; dynamoDeleted: number }> {
  const { org } = tursoConfig();
  const tableName = (Resource as any).UserKitDbs.name;
  let destroyed = 0;
  let dynamoDeleted = 0;

  for (const entry of userDbs) {
    const dbName = sanitizeDbName(entry.userId, kitId);

    if (dryRun) {
      info(`[DRY RUN] Would destroy Turso DB ${dbName} and DynamoDB entry`);
      destroyed++;
      dynamoDeleted++;
      continue;
    }

    // Destroy Turso database
    try {
      await tursoFetch(`/organizations/${org}/databases/${dbName}`, {
        method: "DELETE",
      });
      pass(`Destroyed Turso DB: ${dbName}`);
      destroyed++;
    } catch (err: any) {
      if (err.message.includes("404")) {
        info(`Turso DB already gone: ${dbName}`);
        destroyed++;
      } else {
        warnOrFail(`Failed to destroy Turso DB ${dbName}: ${err.message}`);
      }
    }

    // Delete DynamoDB entry
    try {
      await dynamo.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: marshall({ userId: entry.userId, kitId: entry.kitId }),
        })
      );
      pass(`Deleted DynamoDB entry: ${entry.userId}/${kitId}`);
      dynamoDeleted++;
    } catch (err: any) {
      warnOrFail(`Failed to delete DynamoDB entry: ${err.message}`);
    }
  }

  return { destroyed, dynamoDeleted };
}

// ── Step 5: Clean platform Turso tables ─────────────────────────

async function cleanPlatformTables(
  kitId: string,
  kitSlug: string,
  dryRun: boolean
): Promise<number> {
  const client = createClient({
    url: (Resource as any).TursoDbUrl.value,
    authToken: (Resource as any).TursoAuthToken.value,
  });

  let totalRows = 0;

  const deletions: Array<{ label: string; sql: string; args: any[] }> = [
    { label: "kit_registry", sql: "DELETE FROM kit_registry WHERE kit_id = ?", args: [kitId] },
    { label: "kit_views", sql: "DELETE FROM kit_views WHERE kit_id = ?", args: [kitId] },
    { label: "kit_activations", sql: "DELETE FROM kit_activations WHERE kit_slug = ?", args: [kitSlug] },
    { label: "authz_tuples", sql: "DELETE FROM authz_tuples WHERE object_type = 'kit' AND object_id = ?", args: [kitSlug] },
    { label: "kits", sql: "DELETE FROM kits WHERE slug = ?", args: [kitSlug] },
    { label: "reviews", sql: "DELETE FROM reviews WHERE target_type = 'kit' AND target_slug = ?", args: [kitSlug] },
    { label: "wishlists", sql: "DELETE FROM wishlists WHERE target_type = 'kit' AND target_slug = ?", args: [kitSlug] },
  ];

  try {
    for (const { label, sql, args } of deletions) {
      try {
        if (dryRun) {
          const countSql = sql.replace(/^DELETE FROM/, "SELECT COUNT(*) as cnt FROM");
          const result = await client.execute({ sql: countSql, args });
          const cnt = (result.rows[0] as any)?.cnt ?? 0;
          info(`[DRY RUN] ${label}: ${cnt} row(s) would be deleted`);
          totalRows += Number(cnt);
        } else {
          const result = await client.execute({ sql, args });
          const affected = result.rowsAffected;
          if (affected > 0) {
            pass(`${label}: ${affected} row(s) deleted`);
          } else {
            info(`${label}: 0 rows (already clean)`);
          }
          totalRows += affected;
        }
      } catch (err: any) {
        warnOrFail(`${label}: ${err.message}`);
      }
    }
  } finally {
    client.close();
  }

  return totalRows;
}

// ── Step 6: Delete S3 artifacts ─────────────────────────────────

async function deleteS3Prefix(
  bucketName: string,
  prefix: string,
  dryRun: boolean
): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const keys = (list.Contents || []).map((obj) => obj.Key!);
    if (keys.length === 0) break;

    if (dryRun) {
      for (const key of keys) info(`[DRY RUN] Would delete s3://${bucketName}/${key}`);
      deleted += keys.length;
    } else {
      // Batch delete (max 1000 per request)
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: batch.map((Key) => ({ Key })) },
          })
        );
      }
      deleted += keys.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

async function deleteS3Artifacts(
  kitId: string,
  dryRun: boolean
): Promise<number> {
  const bucketName = (Resource as any).KitAssets.name;
  let total = 0;

  for (const prefix of [`bundles/${kitId}/`, `apps/kits/${kitId}/`]) {
    const count = await deleteS3Prefix(bucketName, prefix, dryRun);
    if (count > 0) {
      pass(`${dryRun ? "[DRY RUN] " : ""}${prefix}: ${count} object(s) ${dryRun ? "would be " : ""}deleted`);
    } else {
      info(`${prefix}: empty`);
    }
    total += count;
  }

  return total;
}

// ── Step 7: Delete Lambda + logs ────────────────────────────────

async function deleteLambda(kitId: string, dryRun: boolean): Promise<void> {
  const functionName = `Kit-${kitId}`;
  const logGroupName = `/aws/lambda/${functionName}`;

  if (dryRun) {
    info(`[DRY RUN] Would delete Lambda ${functionName}`);
    info(`[DRY RUN] Would delete log group ${logGroupName}`);
    return;
  }

  try {
    await lambda.send(new DeleteFunctionCommand({ FunctionName: functionName }));
    pass(`Deleted Lambda: ${functionName}`);
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      info(`Lambda already gone: ${functionName}`);
    } else {
      warnOrFail(`Failed to delete Lambda: ${err.message}`);
    }
  }

  try {
    await logs.send(new DeleteLogGroupCommand({ logGroupName }));
    pass(`Deleted log group: ${logGroupName}`);
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      info(`Log group already gone: ${logGroupName}`);
    } else {
      warnOrFail(`Failed to delete log group: ${err.message}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────

const USAGE = `
Usage: npx tsx scripts/remove-kit.ts <kitId> [options]

Options:
  --dry-run   Preview what would be deleted (no destructive actions)
  --force     Skip confirmation prompt

Example:
  npx sst shell --stage production -- npx tsx scripts/remove-kit.ts crm
  npx sst shell --stage production -- npx tsx scripts/remove-kit.ts crm --dry-run
`.trim();

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const kitId = args[0];
  const dryRun = flags.includes("--dry-run");
  const force = flags.includes("--force");

  if (!kitId) {
    console.log(USAGE);
    process.exit(1);
  }

  const kitSlug = `${kitId}-kit`;
  const prefix = dryRun ? "[DRY RUN] " : "";

  console.log(`\n${prefix}KitStack Kit Removal: ${kitId}\n`);

  // ── Step 1: Discover ──────────────────────────────────────────
  console.log("Step 1: Discovering affected users...");
  const userDbs = await findUserDbs(kitId);
  info(`Found ${userDbs.length} user database(s) for kit "${kitId}"`);

  // ── Step 2: Confirm ───────────────────────────────────────────
  console.log(`
${"─".repeat(50)}
  Kit:          ${kitId}
  Slug:         ${kitSlug}
  User DBs:     ${userDbs.length}
  Lambda:       Kit-${kitId}
  S3 prefixes:  bundles/${kitId}/, apps/kits/${kitId}/
  Turso tables: kit_registry, kit_views, kit_activations,
                authz_tuples, kits, reviews, wishlists
${"─".repeat(50)}`);

  if (!dryRun && !force) {
    const ok = await confirm("This will PERMANENTLY delete all data. Archives will be saved to S3 first.\nContinue?");
    if (!ok) {
      console.log("\nAborted.\n");
      process.exit(0);
    }
  }

  // ── Step 3: Archive ───────────────────────────────────────────
  let archivedCount = 0;
  if (userDbs.length > 0) {
    console.log(`\nStep 3: Archiving ${userDbs.length} user database(s) to S3...`);
    archivedCount = await archiveUserDbs(kitId, userDbs, dryRun);
  }

  // ── Step 4: Destroy user DBs + DynamoDB ───────────────────────
  let destroyedCount = 0;
  let dynamoCount = 0;
  if (userDbs.length > 0) {
    console.log(`\nStep 4: Destroying user databases + DynamoDB entries...`);
    const result = await destroyUserDbs(kitId, userDbs, dryRun);
    destroyedCount = result.destroyed;
    dynamoCount = result.dynamoDeleted;
  }

  // ── Step 5: Clean platform tables ─────────────────────────────
  console.log("\nStep 5: Cleaning platform Turso tables...");
  const tursoRows = await cleanPlatformTables(kitId, kitSlug, dryRun);

  // ── Step 6: Delete S3 artifacts ───────────────────────────────
  console.log("\nStep 6: Deleting S3 artifacts...");
  const s3Count = await deleteS3Artifacts(kitId, dryRun);

  // ── Step 7: Delete Lambda + logs ──────────────────────────────
  console.log("\nStep 7: Deleting Lambda + CloudWatch logs...");
  await deleteLambda(kitId, dryRun);

  // ── Summary ───────────────────────────────────────────────────
  const verb = dryRun ? "would be" : "";
  console.log(`
${"─".repeat(50)}
  ${prefix}Removal complete for kit "${kitId}"

  Archived:   ${archivedCount} user database(s) ${verb} to S3
  Destroyed:  ${destroyedCount} Turso database(s) ${verb} removed
  DynamoDB:   ${dynamoCount} entrie(s) ${verb} removed
  Turso:      ${tursoRows} row(s) ${verb} deleted across platform tables
  S3:         ${s3Count} object(s) ${verb} deleted
  Failures:   ${failures}
${"─".repeat(50)}
`);

  if (failures > 0) {
    console.error(`${prefix}Completed with ${failures} failure(s). Check warnings above.\n`);
    process.exit(1);
  } else {
    console.log(`${prefix}All clean.\n`);
  }
}

main().catch((err) => {
  console.error("Remove-kit script error:", err);
  process.exit(1);
});
