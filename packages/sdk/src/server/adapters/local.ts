import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitToolResult, KitContext, ToolDefinition, AuthzRequirement } from "../../types";
import { createKitContext } from "../../context";
import type { KitServerAdapter, ResolvedKit, ServerRequestContext } from "../types";
import { createDispatchEnvelope, dispatch } from "../dispatch";
import type { DispatchTarget } from "../dispatch";
import { zodToJsonSchema } from "../../runtime/zod-to-json-schema";
import { generateShell } from "../../shell-template";

export interface LocalAdapterOptions {
  /** The kit definition. */
  kit: KitDefinition;
  /** The database connection. */
  db: LibSQLDatabase;
  /** User ID for single-user mode. Default: "dev-user". */
  userId?: string;
  /** Host-supplied request context fields other than the database binding. */
  context?: Partial<KitContext>;
  /** Pre-built shell HTML. If omitted, generated from shell-template. */
  shellHtml?: string;
  /** CDN URL for platform assets. */
  platformCdn?: string;
  /** CDN URL for kit assets. */
  kitCdn?: string;
  /** Dev asset base URL for relay mode. */
  devAssetBaseUrl?: string;
  /** Authorization check function. If omitted, authorize hooks are skipped. */
  checkAuthz?: (
    db: LibSQLDatabase,
    requirement: AuthzRequirement,
    ctx: KitContext
  ) => Promise<boolean>;
}

/**
 * Local adapter for single-kit, in-process execution.
 *
 * Used by:
 * - `kitstack dev` (dev server)
 * - `kitstack serve` (self-hosted)
 * - Tool Iterator skill (in-process testing)
 *
 * All tool handlers run directly against the provided database.
 * No network, no Lambda, no DynamoDB.
 */
export function localAdapter(options: LocalAdapterOptions): KitServerAdapter {
  const { kit, db } = options;
  const defaultUserId = options.userId ?? "dev-user";

  // Pre-compute maps
  const toolMap = new Map<string, ToolDefinition>(
    kit.tools.map((t) => [t.name, t])
  );
  const viewMap = new Map(
    (kit.views ?? []).map((v) => [v.slug, v])
  );

  // Pre-generate shell HTML
  const shellHtml =
    options.shellHtml ??
    (kit.views?.length
      ? generateShell({
          kitId: kit.id,
          platformCdn: options.platformCdn ?? "",
          kitCdn: options.kitCdn ?? "",
          views: (kit.views ?? []).map((v) => ({
            slug: v.slug,
            height: v.height,
          })),
        })
      : "");

  // Pre-compute resolved kit (doesn't change at runtime)
  const resolvedKit: ResolvedKit = {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    triggers: kit.triggers ?? [],
    instructions: kit.instructions || null,
    tools: kit.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.args),
    })),
    views: (kit.views ?? []).map((v) => ({
      slug: v.slug,
      name: v.name,
      description: v.description,
    })),
  };

  function makeCtx(userId: string, session?: KitContext["session"]): KitContext {
    const effectiveUserId = userId || defaultUserId;
    const base = options.context;
    return createKitContext({
      db,
      params: base?.params,
      connectors: base?.connectors,
      identity: {
        principal: effectiveUserId,
        actor: effectiveUserId,
        ...base?.identity,
      },
      channel: { kind: "internal", ...base?.channel },
      session: {
        id: session?.id ?? crypto.randomUUID(),
        traceId: session?.traceId ?? crypto.randomUUID(),
        ...(session?.parentId ? { parentId: session.parentId } : {}),
        ...base?.session,
      },
      telemetry: base?.telemetry,
      audit: base?.audit,
      log: base?.log,
    });
  }

  return {
    async resolveUserKits() {
      // Single-kit local mode — always returns the one kit
      return [resolvedKit];
    },

    async executeTool(kitId, toolName, args, userId) {
      const tool = toolMap.get(toolName);

      const envelope = createDispatchEnvelope({
        kitId,
        command: toolName,
        args: args as Record<string, unknown>,
        principal: userId || defaultUserId,
        context: {
          channel: options.context?.channel ?? { kind: "internal" },
          session: options.context?.session,
        },
      });
      const target: DispatchTarget | undefined = tool
        ? {
            kitId,
            command: toolName,
            validate(input) {
              const parsed = tool.args.safeParse(input);
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
            authorize: tool.authorize
              ? (input, ctx) => tool.authorize!(input, ctx)
              : undefined,
          }
        : undefined;

      return dispatch(envelope, {
        resolve: async (request) => {
          if (request.kitId !== kit.id) {
            return {
              error: { code: "unknown_kit", message: `Kit "${request.kitId}" not found.` },
            };
          }
          if (request.command !== toolName) {
            return {
              error: {
                code: "unknown_tool",
                message: `Unknown tool: "${request.command}". Available: ${[...toolMap.keys()].join(", ")}`,
              },
            };
          }
          if (!target) {
            return {
              error: {
                code: "unknown_tool",
                message: `Unknown tool: "${request.command}". Available: ${[...toolMap.keys()].join(", ")}`,
              },
            };
          }
          return { target };
        },
        createContext: (request) => makeCtx(request.identity.principal, request.session),
        checkGrant: options.checkAuthz
          ? async (request, requirements, ctx) => {
              for (const requirement of requirements) {
                const allowed = await options.checkAuthz!(db, requirement, ctx!);
                if (!allowed) {
                  return {
                    allowed: false,
                    reason: `Forbidden: missing "${requirement.relation}" on ${requirement.objectType} "${requirement.objectId}"`,
                  };
                }
              }
              return { allowed: true };
            }
          : undefined,
        invoke: async (_request, _target, parsedArgs, ctx) => {
          if (!tool) throw new Error(`Unknown tool: "${toolName}"`);
          return tool.handler!(ctx!, parsedArgs);
        },
      });
    },

    async executeLoader(kitId, viewSlug, userId, requestContext?: ServerRequestContext) {
      const view = viewMap.get(viewSlug);
      if (!view) {
        throw new Error(`Unknown view: "${viewSlug}"`);
      }
      const sessionId = requestContext?.sessionId ?? requestContext?.requestId;
      const traceId = requestContext?.traceId ?? sessionId;
      const result = await dispatch(
        createDispatchEnvelope({
          kitId,
          command: `view:${viewSlug}`,
          principal: userId || defaultUserId,
          context: {
            channel: options.context?.channel ?? { kind: "internal", id: requestContext?.requestId },
            session: {
              id: sessionId ?? crypto.randomUUID(),
              traceId: traceId ?? crypto.randomUUID(),
              ...(requestContext?.parentId ? { parentId: requestContext.parentId } : {}),
            },
          },
        }),
        {
          resolve: async () => ({ target: { kitId, command: `view:${viewSlug}` } }),
          createContext: (request) => makeCtx(request.identity.principal, request.session),
          invoke: async (_request, _target, _args, ctx) => ({
            content: [{ type: "text" as const, text: JSON.stringify(await view.loader(ctx!)) }],
          }),
        },
      );
      if (result.isError) {
        const message = result.content.find((block) => block.type === "text")?.text ?? "View loader failed";
        throw new Error(message);
      }
      const payload = result.content.find((block) => block.type === "text");
      return payload?.type === "text" ? JSON.parse(payload.text) : null;
    },

    async getShellHtml() {
      return shellHtml;
    },
  };
}
