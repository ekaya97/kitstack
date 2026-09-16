import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineJob, dispatchJob, jobIdentity } from "../src/index";

describe("defineJob", () => {
  it("validates the smallest scheduled-job contract", () => {
    const job = defineJob({
      name: "refresh_accounts",
      description: "Refresh account data from the connected provider.",
      schedule: "rate(5 minutes)",
      timeoutSeconds: 30,
      args: z.object({ cursor: z.string().optional() }),
      handler: async () => undefined,
    });

    expect(job.name).toBe("refresh_accounts");
    expect(() => defineJob({ ...job, name: "RefreshAccounts" })).toThrow("snake_case");
    expect(() => defineJob({ ...job, schedule: "every five minutes" })).toThrow("cron(...) or rate(...)");
    expect(() => defineJob({ ...job, timeoutSeconds: 0 })).toThrow("positive integer");
  });

  it("rejects duplicate jobs at kit definition time", async () => {
    const { defineKit } = await import("../src/index");
    const job = defineJob({
      name: "refresh_accounts",
      description: "Refresh account data from the connected provider.",
      schedule: "cron(0 * * * ? *)",
      timeoutSeconds: 30,
      handler: async () => undefined,
    });
    expect(() => defineKit({
      id: "jobs",
      version: "0.1.0",
      name: "Jobs",
      description: "A job fixture kit",
      schema: {},
      migrationSql: "SELECT 1;",
      instructions: "Run the declared job.",
      tools: [],
      jobs: [job, job],
    })).toThrow("duplicate job names");
  });
});

describe("dispatchJob", () => {
  it("invokes under a stable job identity and scheduler envelope", async () => {
    const job = defineJob({
      name: "refresh_accounts",
      description: "Refresh account data from the connected provider.",
      schedule: "rate(5 minutes)",
      timeoutSeconds: 30,
      args: z.object({ cursor: z.string() }),
      handler: async (ctx, args) => ({
        content: [{ type: "text", text: `${ctx.identity.principal}:${args.cursor}` }],
      }),
    });
    const completed: string[] = [];
    const result = await dispatchJob(job, {
      kitId: "kit:accounts",
      jobName: job.name,
      jobId: "lease-1",
      args: { cursor: "page-2" },
    }, {
      createContext: (envelope) => ({
        db: {} as never,
        params: {},
        connectors: { get: () => undefined, has: () => false, require: () => { throw new Error("not used"); } },
        identity: envelope.identity,
        channel: envelope.channel,
        session: envelope.session,
        telemetry: { event: () => undefined, metric: () => undefined },
        audit: { record: () => undefined },
        log: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
      }),
      onComplete: async (envelope) => {
        completed.push(`${envelope.identity.principal}:${envelope.channel.kind}`);
      },
    });

    expect(result).toEqual({ content: [{ type: "text", text: `${jobIdentity("kit:accounts", job.name)}:page-2` }] });
    expect(completed).toEqual(["job:kit:accounts:refresh_accounts:scheduler"]);
  });
});
