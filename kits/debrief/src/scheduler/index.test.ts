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
