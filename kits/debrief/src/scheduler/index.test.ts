import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  createScheduledCallJob,
  createScheduledCallStore,
  ScheduledCallPoller,
  type ScheduledCallOperations,
} from "./index.js";

const clients: Client[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

function database(): Client {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  return client;
}

class FakeClock {
  private current: Date;

  constructor(value: string) {
    this.current = new Date(value);
  }

  now = (): string => this.current.toISOString();

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

function input(scheduledAt: string) {
  return { orgId: "org-demo", sessionId: "session-1", scheduledAt };
}

describe("persisted scheduled calls", () => {
  it("schedules, advances a fake clock, claims once, and invokes the provider seam once", async () => {
    const clock = new FakeClock("2026-09-15T20:00:00.000Z");
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => "scheduled-1" });
    const scheduled = await store.schedule(input("2026-09-15T20:05:00.000Z"));
    const started: string[] = [];
    const poller = new ScheduledCallPoller({
      operations: store,
      orgId: "org-demo",
      workerId: "worker-1",
      now: clock.now,
      startCall: async (job) => {
        started.push(job.scheduledCallId);
        return "CA-demo-1";
      },
    });

    expect(await poller.pollOnce()).toBeNull();
    clock.advance(5 * 60 * 1000);
    const result = await poller.pollOnce();
    expect(result).toMatchObject({
      scheduledCallId: scheduled.scheduledCallId,
      status: "started",
      attemptCount: 1,
      providerCallId: "CA-demo-1",
    });
    expect(started).toEqual(["scheduled-1"]);
    expect(await poller.pollOnce()).toBeNull();
  });

  it("lets concurrent pollers claim the same due job exactly once", async () => {
    const clock = new FakeClock("2026-09-15T20:05:00.000Z");
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => "scheduled-1" });
    await store.schedule(input(clock.now()));
    const started: string[] = [];
    const provider = async () => {
      started.push("provider");
      await Promise.resolve();
      return "CA-only-once";
    };
    const poller = (workerId: string) => new ScheduledCallPoller({
      operations: store,
      orgId: "org-demo",
      workerId,
      now: clock.now,
      startCall: provider,
    });

    const results = await Promise.all([poller("ecs-task-a").pollOnce(), poller("ecs-task-b").pollOnce()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(started).toHaveLength(1);
    expect(await store.get("org-demo", "scheduled-1")).toMatchObject({ status: "started", attemptCount: 1 });
  });

  it("invokes a declared SDK job through the scheduler path", async () => {
    const clock = new FakeClock("2026-09-15T20:05:00.000Z");
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => "scheduled-1" });
    await store.schedule(input(clock.now()));
    const invoked: string[] = [];
    const poller = new ScheduledCallPoller({
      operations: store,
      orgId: "org-demo",
      workerId: "worker-1",
      now: clock.now,
      job: createScheduledCallJob(async (record) => {
        invoked.push(record.scheduledCallId);
        return "CA-job-1";
      }),
    });

    const result = await poller.pollOnce();
    expect(result).toMatchObject({ status: "started", providerCallId: "CA-job-1", attemptCount: 1 });
    expect(invoked).toEqual(["scheduled-1"]);
  });

  it("marks an uncertain starting job failed after its lease expires and never retries it", async () => {
    const clock = new FakeClock("2026-09-15T20:00:00.000Z");
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => "scheduled-1" });
    await store.schedule(input(clock.now()));
    const claimed = await store.claimDue({ orgId: "org-demo", workerId: "old-task", now: clock.now(), leaseMs: 1_000 });
    expect(claimed).toMatchObject({ status: "starting", leaseOwner: "old-task" });

    clock.advance(1_001);
    const restarted = await store.claimDue({ orgId: "org-demo", workerId: "new-task", now: clock.now(), leaseMs: 1_000 });
    expect(restarted).toBeNull();
    expect(await store.get("org-demo", "scheduled-1")).toMatchObject({
      status: "failed",
      attemptCount: 1,
      error: "Lease expired while starting call; operator action required",
    });
  });

  it("surfaces provider failure through the debrief failure callback", async () => {
    const clock = new FakeClock("2026-09-15T20:00:00.000Z");
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => "scheduled-1" });
    await store.schedule(input(clock.now()));
    const failures: string[] = [];
    const operations: ScheduledCallOperations = store;
    const poller = new ScheduledCallPoller({
      operations,
      orgId: "org-demo",
      workerId: "worker-1",
      now: clock.now,
      startCall: async () => { throw new Error("provider unavailable"); },
      onProviderFailure: async (job, error) => { failures.push(`${job.sessionId}:${String(error)}`); },
    });

    const result = await poller.pollOnce();
    expect(result).toMatchObject({ status: "failed", error: "provider unavailable" });
    expect(failures).toEqual(["session-1:Error: provider unavailable"]);
  });

  it("schedules a debrief and a prebrief job for the same session with different purposes", async () => {
    const clock = new FakeClock("2026-09-15T18:00:00.000Z");
    let n = 0;
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => `scheduled-${++n}` });
    const debrief = await store.schedule({ orgId: "org-demo", sessionId: "session-1", scheduledAt: "2026-09-15T20:00:00.000Z", purpose: "debrief" });
    const prebrief = await store.schedule({ orgId: "org-demo", sessionId: "session-1", scheduledAt: "2026-09-15T19:00:00.000Z", purpose: "prebrief" });
    expect(debrief.purpose).toBe("debrief");
    expect(prebrief.purpose).toBe("prebrief");
    expect(debrief.scheduledCallId).not.toBe(prebrief.scheduledCallId);

    const jobs = await store.list("org-demo");
    expect(jobs.map((job) => ({ purpose: job.purpose, scheduledAt: job.scheduledAt }))).toEqual([
      { purpose: "prebrief", scheduledAt: "2026-09-15T19:00:00.000Z" },
      { purpose: "debrief", scheduledAt: "2026-09-15T20:00:00.000Z" },
    ]);

    // Claiming due jobs in order carries the purpose through to the provider seam.
    clock.advance(2 * 3600_000);
    const claimedPurposes: string[] = [];
    const poller = new ScheduledCallPoller({
      operations: store,
      orgId: "org-demo",
      workerId: "worker-1",
      now: clock.now,
      startCall: async (job) => { claimedPurposes.push(job.purpose); return `CA-${job.purpose}`; },
    });
    expect(await poller.pollOnce()).toMatchObject({ purpose: "prebrief", providerCallId: "CA-prebrief" });
    expect(await poller.pollOnce()).toMatchObject({ purpose: "debrief", providerCallId: "CA-debrief" });
    expect(claimedPurposes).toEqual(["prebrief", "debrief"]);
  });

  it("schedules without a purpose as a debrief job, matching the pre-existing single-call behavior", async () => {
    const store = createScheduledCallStore(database(), { createScheduledCallId: () => "scheduled-1" });
    const scheduled = await store.schedule(input("2026-09-15T20:05:00.000Z"));
    expect(scheduled.purpose).toBe("debrief");
  });

  it("clears scheduled calls on reset", async () => {
    const store = createScheduledCallStore(database(), { createScheduledCallId: () => "scheduled-1" });
    await store.schedule(input("2026-09-15T20:00:00.000Z"));
    await store.reset("org-demo");
    expect(await store.list("org-demo")).toEqual([]);
  });

  it("uses the trigger-backed invocation seam when a daemon host provides one", async () => {
    const clock = new FakeClock("2026-09-15T20:00:00.000Z");
    const store = createScheduledCallStore(database(), { now: clock.now, createScheduledCallId: () => "scheduled-1" });
    await store.schedule(input(clock.now()));
    const calls: string[] = [];
    const poller = new ScheduledCallPoller({
      operations: store,
      orgId: "org-demo",
      workerId: "daemon-1",
      now: clock.now,
      startCall: async () => { throw new Error("direct provider seam should not run"); },
      invokeTrigger: async (job) => { calls.push(job.sessionId); return "CA-trigger-1"; },
    });

    const result = await poller.pollOnce();
    expect(result).toMatchObject({ status: "started", providerCallId: "CA-trigger-1" });
    expect(calls).toEqual(["session-1"]);
  });
});
