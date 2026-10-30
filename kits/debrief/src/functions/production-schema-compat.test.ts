import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createScheduledCallStore } from "../scheduler/index.js";
import { createDebriefPersistence } from "./persistence.js";

/**
 * The exact DDL the production database was created with, before `purpose`,
 * `owner_id`, `target_session_id`, or `debrief_meeting_plans` existed. Both
 * tables already hold live rows there, and SQLite cannot rebuild a table (to
 * drop or widen a constraint) without a DROP, which is forbidden. This test
 * seeds a database with that exact shape, plus a pre-existing row in each
 * table, and proves the current code still works against it unmodified:
 * scheduling both a debrief and a prebrief call for one session, and saving
 * a meeting plan, without altering or rebuilding either original table.
 */
const OLD_SCHEDULED_CALLS_DDL = `
  CREATE TABLE scheduled_calls (
    scheduled_call_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'starting', 'started', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    lease_owner TEXT,
    lease_expires_at TEXT,
    provider_call_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX scheduled_calls_due_idx
    ON scheduled_calls (org_id, status, scheduled_at, scheduled_call_id);
  CREATE INDEX scheduled_calls_lease_idx
    ON scheduled_calls (org_id, status, lease_expires_at, scheduled_call_id);
  CREATE INDEX scheduled_calls_session_idx
    ON scheduled_calls (org_id, session_id);
`;

const OLD_CUSTOMER_EVENTS_DDL = `
  CREATE TABLE demo_customer_events (
    event_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    kit_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('prebrief', 'call_completed', 'note', 'address_discovered', 'debrief_confirmed')),
    occurred_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
`;

const clients: Client[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

async function productionShapedDatabase(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.executeMultiple(OLD_SCHEDULED_CALLS_DDL);
  await client.executeMultiple(OLD_CUSTOMER_EVENTS_DDL);
  // A pre-existing live row in each table, from before this feature shipped.
  await client.execute({
    sql: `INSERT INTO scheduled_calls
      (scheduled_call_id, org_id, session_id, scheduled_at, status, attempt_count, created_at, updated_at)
      VALUES ('scheduled-legacy', 'org-demo', 'session-legacy', '2026-01-01T00:00:00.000Z', 'started', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    args: [],
  });
  await client.execute({
    sql: `INSERT INTO demo_customer_events (event_id, org_id, customer_id, session_id, kit_id, type, occurred_at, payload_json)
      VALUES ('event-legacy', 'org-demo', 'customer-legacy', 'session-legacy', 'kit:debrief', 'prebrief', '2026-01-01T00:00:00.000Z', '{}')`,
    args: [],
  });
  return client;
}

describe("production schema compatibility", () => {
  it("schedules a debrief and a prebrief call, and saves a meeting plan, against the exact production table shapes", async () => {
    const client = await productionShapedDatabase();

    const scheduler = createScheduledCallStore(client, { createScheduledCallId: (() => { let n = 0; return () => `scheduled-new-${++n}`; })() });
    const debriefJob = await scheduler.schedule({
      orgId: "org-demo", sessionId: "session-1", scheduledAt: "2026-09-15T20:00:00.000Z", purpose: "debrief", ownerId: "user-1",
    });
    const prebriefJob = await scheduler.schedule({
      orgId: "org-demo", sessionId: "session-1", scheduledAt: "2026-09-15T19:00:00.000Z", purpose: "prebrief", ownerId: "user-1",
    });
    expect(debriefJob).toMatchObject({ sessionId: "session-1", purpose: "debrief" });
    expect(prebriefJob).toMatchObject({ sessionId: "session-1", purpose: "prebrief" });
    expect(debriefJob.scheduledCallId).not.toBe(prebriefJob.scheduledCallId);
    // Both rows resolve back to the real session id, never a derived key.
    const jobs = await scheduler.list("org-demo");
    expect(jobs.filter((job) => job.sessionId === "session-1").map((job) => job.purpose).sort()).toEqual(["debrief", "prebrief"]);
    expect(await scheduler.countForOwnerSince("org-demo", "user-1", "2026-09-15T00:00:00.000Z")).toBe(2);
    // The legacy single-purpose row (predating `purpose`) is untouched and still reads back correctly.
    expect(await scheduler.get("org-demo", "scheduled-legacy")).toMatchObject({ sessionId: "session-legacy", purpose: "debrief", status: "started" });

    const persistence = createDebriefPersistence(client);
    await persistence.saveMeetingPlan({
      orgId: "org-demo", sessionId: "session-1", customerId: "customer-1", kitId: "kit:debrief",
      plan: "Confirm pricing and get a signature.", createdAt: "2026-09-15T18:00:00.000Z", updatedAt: "2026-09-15T18:00:00.000Z",
    });
    expect(await persistence.getMeetingPlan("org-demo", "session-1")).toMatchObject({ plan: "Confirm pricing and get a signature." });
    // The legacy customer event (under the original five-value CHECK) still reads back correctly.
    expect(await persistence.listCustomerEvents("org-demo", "customer-legacy")).toEqual([
      expect.objectContaining({ eventId: "event-legacy", type: "prebrief" }),
    ]);
  });
});
