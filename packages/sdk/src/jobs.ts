import type { z } from "zod";
import type { KitContext, KitToolResult, JobDefinition, SessionContext } from "./types";
import {
  createDispatchEnvelope,
  dispatch,
  type DispatchDependencies,
  type DispatchEnvelope,
  type DispatchResult,
  type DispatchTarget,
} from "./server/dispatch";

/** Durable state a host must preserve while polling a declared job. */
export type JobLeaseStatus = "scheduled" | "starting" | "completed" | "failed";

export interface JobLeaseRecord {
  jobId: string;
  kitId: string;
  jobName: string;
  orgId: string;
  scheduledAt: string;
  status: JobLeaseStatus;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimJobInput {
  orgId: string;
  kitId: string;
  jobName: string;
  now: string;
  workerId: string;
  leaseMs?: number;
}

export interface CompleteJobInput {
  orgId: string;
  jobId: string;
  workerId: string;
  now: string;
}

export interface FailJobInput {
  orgId: string;
  jobId: string;
  workerId: string;
  reason: string;
  now: string;
}

/**
 * Host storage contract for the claim/lease protocol. Claim implementations
 * must atomically select one due row, mark it starting, and increment the
 * attempt count. An expired starting lease is terminal and must be surfaced
 * for operator action rather than silently retried.
 */
export interface JobLeaseOperations<TRecord extends JobLeaseRecord = JobLeaseRecord> {
  claimDue(input: ClaimJobInput): Promise<TRecord | null>;
  complete(input: CompleteJobInput): Promise<TRecord>;
  fail(input: FailJobInput): Promise<TRecord>;
}

export interface JobDispatchInput {
  kitId: string;
  jobName: string;
  jobId: string;
  args?: Record<string, unknown>;
  principal?: string;
  session?: SessionContext;
}

/** Stable identity used by all invocations of a declared job. */
export function jobIdentity(kitId: string, jobName: string): string {
  return `job:${kitId}:${jobName}`;
}

/** Create the channel-neutral envelope for a scheduler-owned invocation. */
export function createJobDispatchEnvelope(input: JobDispatchInput): DispatchEnvelope {
  const principal = input.principal ?? jobIdentity(input.kitId, input.jobName);
  return createDispatchEnvelope({
    kitId: input.kitId,
    command: input.jobName,
    args: input.args,
    principal,
    context: {
      session: input.session ?? {
        id: input.jobId,
        traceId: `trace:${input.jobId}`,
      },
      channel: {
        kind: "scheduler",
        id: input.jobId,
        metadata: { jobName: input.jobName },
      },
    },
  });
}

/**
 * Run a declared job through the same dispatch pipeline as tools. Hosts may
 * add grant/policy/completion hooks, but the envelope always carries the job
 * identity and scheduler channel metadata.
 */
export async function dispatchJob<T extends z.ZodType>(
  job: JobDefinition<T>,
  input: JobDispatchInput,
  dependencies: Omit<DispatchDependencies, "resolve" | "invoke"> & {
    createContext?: DispatchDependencies["createContext"];
  } = {},
): Promise<DispatchResult> {
  const envelope = createJobDispatchEnvelope(input);
  const target: DispatchTarget = {
    kitId: input.kitId,
    command: job.name,
    validate(args) {
      if (!job.args) return { success: true, data: args };
      const parsed = job.args.safeParse(args);
      if (!parsed.success) {
        return {
          success: false,
          message: parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        };
      }
      return { success: true, data: parsed.data as Record<string, unknown> };
    },
  };

  return dispatch(envelope, {
    ...dependencies,
    resolve: async (request) => {
      if (request.kitId !== input.kitId || request.command !== job.name) {
        return { error: { code: "unknown_tool", message: `Unknown job: "${request.command}"` } };
      }
      return { target };
    },
    invoke: async (_request, _target, args, ctx) => {
      const result = await job.handler(ctx as KitContext, args as z.infer<T>);
      return result ?? emptyJobResult();
    },
  });
}

function emptyJobResult(): KitToolResult {
  return { content: [] };
}
