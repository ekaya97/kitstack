import type {
  AgentDefinition,
  AgentInput,
  AgentLifecycleEvent,
  AgentMessage,
  AgentModelResponse,
  AgentRunError,
  AgentRunResult,
  AgentSession,
  DefineAgentConfig,
} from "./types";

const DEFAULT_MAX_TURNS = 10;
const DEFAULT_MAX_DURATION_MS = 60_000;

type ControlReason = "cancelled" | "timed_out";

class AgentControlError extends Error {
  constructor(readonly reason: ControlReason) {
    super(reason);
    this.name = "AgentControlError";
  }
}

function validateConfig<TContext extends Record<string, unknown>>(
  config: DefineAgentConfig<TContext>
): { maxTurns: number; maxDurationMs: number } {
  const requiredStrings: Array<[string, unknown]> = [
    ["id", config.id],
    ["kitId", config.kitId],
    ["trigger.id", config.trigger?.id],
    ["trigger.identity", config.trigger?.identity],
    ["instructions.version", config.instructions?.version],
    ["instructions.content", config.instructions?.content],
  ];
  for (const [name, value] of requiredStrings) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`defineAgent: ${name} must be a non-empty string`);
    }
  }

  if (!config.turnSource || typeof config.turnSource.next !== "function") {
    throw new TypeError("defineAgent: turnSource.next must be a function");
  }
  if (!config.model || typeof config.model.turn !== "function") {
    throw new TypeError("defineAgent: model.turn must be a function");
  }
  if (!config.output || typeof config.output.emit !== "function") {
    throw new TypeError("defineAgent: output.emit must be a function");
  }
  if (!Array.isArray(config.tools)) {
    throw new TypeError("defineAgent: tools must be an array");
  }

  const names = new Set<string>();
  for (const tool of config.tools) {
    if (!tool || typeof tool.name !== "string" || tool.name.trim().length === 0) {
      throw new TypeError("defineAgent: every tool must have a non-empty name");
    }
    if (names.has(tool.name)) {
      throw new TypeError(`defineAgent: duplicate tool name "${tool.name}"`);
    }
    names.add(tool.name);
    if (typeof tool.execute !== "function") {
      throw new TypeError(`defineAgent: tool "${tool.name}" must have an execute function`);
    }
  }

  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxDurationMs = config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new TypeError("defineAgent: maxTurns must be a positive integer");
  }
  if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
    throw new TypeError("defineAgent: maxDurationMs must be a positive number");
  }
  return { maxTurns, maxDurationMs };
}

function errorFor(reason: ControlReason): AgentRunError {
  return reason === "timed_out"
    ? { code: "AGENT_TIMEOUT", message: "Agent run exceeded its wall-clock limit" }
    : { code: "AGENT_CANCELLED", message: "Agent run was cancelled" };
}

function errorCodeFor(source: "source" | "model" | "tool" | "output"): AgentRunError["code"] {
  switch (source) {
    case "source":
      return "AGENT_SOURCE_ERROR";
    case "model":
      return "AGENT_MODEL_ERROR";
    case "tool":
      return "AGENT_TOOL_ERROR";
    case "output":
      return "AGENT_OUTPUT_ERROR";
  }
}

function asError(error: unknown, code: AgentRunError["code"]): AgentRunError {
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
  };
}

function runWithSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason instanceof AgentControlError ? signal.reason : new AgentControlError("cancelled"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason instanceof AgentControlError ? signal.reason : new AgentControlError("cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

async function emitEvent(hooks: DefineAgentConfig["hooks"], event: AgentLifecycleEvent): Promise<void> {
  if (!hooks?.onEvent) return;
  try {
    await hooks.onEvent(event);
  } catch {
    // Telemetry must never change the agent's outcome or receive a second chance
    // to observe content. Hooks are intentionally best-effort metadata sinks.
  }
}

function createResult<TContext extends Record<string, unknown>>(
  config: DefineAgentConfig<TContext>,
  sessionId: string,
  startedAt: number,
  status: AgentRunResult["status"],
  turns: number,
  toolCalls: number,
  outputs: number,
  finalOutput?: string,
  error?: AgentRunError
): AgentRunResult {
  return {
    status,
    sessionId,
    kitId: config.kitId,
    agentId: config.id,
    triggerId: config.trigger.id,
    instructionsVersion: config.instructions.version,
    turns,
    toolCalls,
    outputs,
    durationMs: Date.now() - startedAt,
    ...(finalOutput === undefined ? {} : { finalOutput }),
    ...(error === undefined ? {} : { error }),
  };
}

/**
 * Define a bounded, provider-neutral autonomous agent loop.
 *
 * The loop keeps its history only in memory for one `run()` call. A connector
 * owns model/provider translation; a turn source owns transport input; and an
 * output sink owns transport output. No prompt, completion, audio, transcript,
 * or tool arguments/results are sent to lifecycle hooks.
 */
export function defineAgent<TContext extends Record<string, unknown> = Record<string, unknown>>(
  config: DefineAgentConfig<TContext>
): AgentDefinition<TContext> {
  const { maxTurns, maxDurationMs } = validateConfig(config);
  const tools = Object.freeze([...config.tools]);
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

  const run = async (options: {
    sessionId: string;
    context?: TContext;
    signal?: AbortSignal;
  }): Promise<AgentRunResult> => {
    if (typeof options?.sessionId !== "string" || options.sessionId.trim().length === 0) {
      throw new TypeError("defineAgent.run: sessionId must be a non-empty string");
    }

    const startedAt = Date.now();
    const session: AgentSession<TContext> = {
      id: options.sessionId,
      // A new top-level object makes independent runs safe even when callers
      // reuse their seed context. Nested values remain caller-owned by design.
      context: { ...(options.context ?? ({} as TContext)) },
    };
    const history: AgentMessage[] = [];
    const controller = new AbortController();
    let controlReason: ControlReason | undefined;
    let turns = 0;
    let toolCalls = 0;
    let outputs = 0;
    let finalOutput: string | undefined;
    let status: AgentRunResult["status"] = "completed";
    let runError: AgentRunError | undefined;
    const externalSignal = options.signal;
    const onExternalAbort = () => {
      controlReason = "cancelled";
      controller.abort(new AgentControlError("cancelled"));
    };
    if (externalSignal?.aborted) onExternalAbort();
    else externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    const timeout = setTimeout(() => {
      controlReason = "timed_out";
      controller.abort(new AgentControlError("timed_out"));
    }, maxDurationMs);

    await emitEvent(config.hooks, {
      type: "run_started",
      kitId: config.kitId,
      agentId: config.id,
      triggerId: config.trigger.id,
      triggerIdentity: config.trigger.identity,
      sessionId: session.id,
      instructionsVersion: config.instructions.version,
      at: startedAt,
    });

    const finish = async (): Promise<AgentRunResult> => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      const result = createResult(
        config,
        session.id,
        startedAt,
        status,
        turns,
        toolCalls,
        outputs,
        finalOutput,
        runError
      );
      await emitEvent(config.hooks, {
        type: "run_finished",
        kitId: config.kitId,
        agentId: config.id,
        triggerId: config.trigger.id,
        sessionId: session.id,
        status: result.status,
        turns: result.turns,
        toolCalls: result.toolCalls,
        durationMs: result.durationMs,
        at: Date.now(),
      });
      return result;
    };

    try {
      if (controlReason) {
        status = "cancelled";
        runError = errorFor("cancelled");
        return await finish();
      }

      let input: AgentInput | null;
      while (true) {
        try {
          input = await runWithSignal(config.turnSource.next({ session, signal: controller.signal }), controller.signal);
        } catch (error) {
          if (error instanceof AgentControlError) throw error;
          status = "failed";
          runError = asError(error, errorCodeFor("source"));
          return await finish();
        }
        if (input === null) return await finish();
        history.push({ role: "user", content: input.content });

        let modelInput: AgentInput | undefined = input;
        while (true) {
          if (turns >= maxTurns) {
            status = "max_turns";
            runError = { code: "AGENT_MAX_TURNS", message: "Agent run reached its maximum model turns" };
            return await finish();
          }
          turns += 1;
          const turnStartedAt = Date.now();
          await emitEvent(config.hooks, {
            type: "turn_started",
            kitId: config.kitId,
            agentId: config.id,
            sessionId: session.id,
            turn: turns,
            at: turnStartedAt,
          });

          let response: AgentModelResponse;
          try {
            response = await runWithSignal(
              config.model.turn({
                session,
                instructions: config.instructions,
                tools,
                history: [...history],
                input: modelInput,
                signal: controller.signal,
              }),
              controller.signal
            );
          } catch (error) {
            await emitEvent(config.hooks, {
              type: "turn_finished",
              kitId: config.kitId,
              agentId: config.id,
              sessionId: session.id,
              turn: turns,
              outcome: "error",
              durationMs: Date.now() - turnStartedAt,
              at: Date.now(),
            });
            if (error instanceof AgentControlError) throw error;
            status = "failed";
            runError = asError(error, errorCodeFor("model"));
            return await finish();
          }

          if (response.type === "message") {
            history.push({ role: "assistant", content: response.content });
            await emitEvent(config.hooks, {
              type: "turn_finished",
              kitId: config.kitId,
              agentId: config.id,
              sessionId: session.id,
              turn: turns,
              outcome: "message",
              durationMs: Date.now() - turnStartedAt,
              at: Date.now(),
            });
            try {
              await runWithSignal(
                config.output.emit({ session, content: response.content, terminal: response.terminal === true }),
                controller.signal
              );
            } catch (error) {
              if (error instanceof AgentControlError) throw error;
              status = "failed";
              runError = asError(error, errorCodeFor("output"));
              return await finish();
            }
            outputs += 1;
            finalOutput = response.content;
            if (response.terminal === true) return await finish();
            modelInput = undefined;
            break;
          }

          const tool = toolMap.get(response.name);
          const toolCallId = response.toolCallId ?? `turn-${turns}-tool-${toolCalls + 1}`;
          if (!tool) {
            await emitEvent(config.hooks, {
              type: "turn_finished",
              kitId: config.kitId,
              agentId: config.id,
              sessionId: session.id,
              turn: turns,
              outcome: "tool_call",
              durationMs: Date.now() - turnStartedAt,
              at: Date.now(),
            });
            await emitEvent(config.hooks, {
              type: "tool_called",
              kitId: config.kitId,
              agentId: config.id,
              sessionId: session.id,
              turn: turns,
              toolName: response.name,
              outcome: "rejected",
              durationMs: 0,
              at: Date.now(),
            });
            status = "failed";
            runError = {
              code: "AGENT_UNDECLARED_TOOL",
              message: `Model requested undeclared tool "${response.name}"`,
            };
            return await finish();
          }

          toolCalls += 1;
          const toolStartedAt = Date.now();
          try {
            const result = await runWithSignal(
              tool.execute(response.args, session, controller.signal),
              controller.signal
            );
            history.push({ role: "tool", toolCallId, name: tool.name, result });
            await emitEvent(config.hooks, {
              type: "tool_called",
              kitId: config.kitId,
              agentId: config.id,
              sessionId: session.id,
              turn: turns,
              toolName: tool.name,
              outcome: "completed",
              durationMs: Date.now() - toolStartedAt,
              at: Date.now(),
            });
          } catch (error) {
            if (error instanceof AgentControlError) throw error;
            history.push({ role: "tool", toolCallId, name: tool.name, result: null, isError: true });
            await emitEvent(config.hooks, {
              type: "tool_called",
              kitId: config.kitId,
              agentId: config.id,
              sessionId: session.id,
              turn: turns,
              toolName: tool.name,
              outcome: "failed",
              durationMs: Date.now() - toolStartedAt,
              at: Date.now(),
            });
            status = "failed";
            runError = asError(error, errorCodeFor("tool"));
            return await finish();
          }
          modelInput = undefined;
        }
      }
    } catch (error) {
      if (error instanceof AgentControlError) {
        status = error.reason === "timed_out" ? "timed_out" : "cancelled";
        runError = errorFor(error.reason);
      } else {
        status = "failed";
        runError = asError(error, "AGENT_MODEL_ERROR");
      }
      return await finish();
    }
  };

  return Object.freeze({
    ...config,
    tools,
    maxTurns,
    maxDurationMs,
    run,
  });
}
