import type { AgentSession, AgentToolDefinition, KitDefinition, KitToolResult, ToolBase } from "./types";
import { zodToJsonSchema } from "./runtime/zod-to-json-schema";

/** Anything that runs a kit tool through KitStack dispatch, e.g. `createKitServer()`. */
export interface KitToolExecutor {
  executeTool(kitId: string, toolName: string, args: Record<string, unknown>, principal: string): Promise<KitToolResult>;
}

/** Provider-neutral function schema derived from a tool's Zod arguments. */
export interface ToolFunctionSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface KitAgentToolsOptions<TContext extends Record<string, unknown> = Record<string, unknown>> {
  kit: KitDefinition;
  executor: KitToolExecutor;
  /** Kit tool names the agent may call. */
  tools: readonly string[];
  /** Identity the calls run as; defaults to the agent session's principal or "agent". */
  principal?: (session: AgentSession<TContext>) => string;
  /**
   * Arguments filled in from the session rather than by the model (for
   * example the session id). They are removed from the model-facing schema.
   */
  boundArgs?: (session: AgentSession<TContext>) => Record<string, unknown>;
  boundArgNames?: readonly string[];
  /** Shorter or channel-specific descriptions for the model. */
  descriptions?: Readonly<Record<string, string>>;
}

export interface KitAgentTools<TContext extends Record<string, unknown> = Record<string, unknown>> {
  /** Tools for `defineAgent`; each call goes through dispatch (validation, authz, telemetry). */
  definitions: AgentToolDefinition<TContext>[];
  /** Function schemas for the model provider, generated from the same Zod definitions. */
  schemas: ToolFunctionSchema[];
}

/** JSON schema for a tool's arguments, optionally hiding arguments the host fills in. */
export function toolFunctionSchema(tool: ToolBase, options: { omit?: readonly string[]; description?: string } = {}): ToolFunctionSchema {
  const { required: allRequired, properties: allProperties, ...rest } = zodToJsonSchema(tool.args) as {
    properties?: Record<string, unknown>;
    required?: string[];
  } & Record<string, unknown>;
  const omit = new Set(options.omit ?? []);
  const properties = Object.fromEntries(Object.entries(allProperties ?? {}).filter(([name]) => !omit.has(name)));
  const required = (allRequired ?? []).filter((name) => !omit.has(name));
  return {
    name: tool.name,
    description: options.description ?? tool.description,
    parameters: {
      ...rest,
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
  };
}

/**
 * Expose kit tools to an agent without a second copy of their definitions.
 * The model sees schemas generated from the tools' Zod arguments, and every
 * call runs through the same dispatch path as MCP.
 */
export function kitAgentTools<TContext extends Record<string, unknown> = Record<string, unknown>>(
  options: KitAgentToolsOptions<TContext>,
): KitAgentTools<TContext> {
  const byName = new Map(options.kit.tools.map((tool) => [tool.name, tool]));
  const selected = options.tools.map((name) => {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Kit "${options.kit.id}" has no tool "${name}"`);
    return tool;
  });
  const omit = options.boundArgNames ?? [];

  return {
    schemas: selected.map((tool) => toolFunctionSchema(tool, { omit, description: options.descriptions?.[tool.name] })),
    definitions: selected.map((tool) => ({
      name: tool.name,
      description: options.descriptions?.[tool.name] ?? tool.description,
      async execute(args, session) {
        const modelArgs = args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {};
        const bound = options.boundArgs?.(session) ?? {};
        const principal = options.principal?.(session) ?? "agent";
        const result = await options.executor.executeTool(options.kit.id, tool.name, { ...modelArgs, ...bound }, principal);
        return unwrapToolResult(result);
      },
    })),
  };
}

/** Turn a kit tool result into agent-friendly output; errors become exceptions. */
export function unwrapToolResult(result: KitToolResult): unknown {
  const text = result.content
    .map((block) => (block as { type: string; text?: string }).type === "text" ? (block as { text?: string }).text ?? "" : "")
    .join("\n")
    .trim();
  if (result.isError) throw new Error(text || "Tool call failed");
  if ((result as { structuredContent?: unknown }).structuredContent !== undefined) {
    return (result as { structuredContent?: unknown }).structuredContent;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
