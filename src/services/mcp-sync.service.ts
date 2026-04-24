/**
 * MCP Sync Service
 *
 * Wraps all DynamoDB operations for the MCP server with retry logic
 * and tools_changed flag management. DynamoDB is the source of truth
 * for MCP entitlement — SQLite is a projection for fast UI reads.
 */

import {
  getUserKitDb,
  putUserKitDb,
  getUserKitDbs,
  updateUserKitDbStatus,
} from "../../packages/mcp-server/src/framework/dynamo";
import { provisionKitDatabase } from "../../packages/mcp-server/src/framework/db-provisioner";
import type { UserKitDbItem } from "../../packages/mcp-server/src/framework/types";
import { log } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      log.warn(`[mcp-sync] ${label} attempt ${attempt}/${MAX_RETRIES} failed`, { error: err.message });
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error("unreachable");
}

// --- Reads ---

export async function getKitDb(
  userId: string,
  kitId: string
): Promise<UserKitDbItem | null> {
  return withRetry(() => getUserKitDb(userId, kitId), `getKitDb(${kitId})`);
}

export async function getActiveKitDbs(
  userId: string
): Promise<UserKitDbItem[]> {
  return withRetry(() => getUserKitDbs(userId), "getActiveKitDbs");
}

// --- Writes ---

export async function provisionKit(
  userId: string,
  kitId: string,
  migrationSql: string
): Promise<{ dbUrl: string; dbToken: string }> {
  // Check if already provisioned
  const existing = await getKitDb(userId, kitId);
  if (existing) {
    // If deactivated, reactivate
    if ((existing as any).status === "deactivated") {
      await withRetry(
        () => updateUserKitDbStatus(userId, kitId, "active"),
        `reactivateKitDb(${kitId})`
      );
    }
    return { dbUrl: existing.dbUrl, dbToken: existing.dbToken };
  }

  // Provision new database
  const result = await withRetry(
    () => provisionKitDatabase(userId, kitId, migrationSql),
    `provisionKit(${kitId})`
  );

  return result;
}

export async function deactivateKitDb(
  userId: string,
  kitId: string
): Promise<void> {
  await withRetry(
    () => updateUserKitDbStatus(userId, kitId, "deactivated"),
    `deactivateKitDb(${kitId})`
  );
}

