/**
 * Platform adapter for the KitStack cloud environment.
 *
 * Resolves kits from Turso registry + DynamoDB entitlements,
 * executes tools via Lambda invocation, and reads shells from S3/CDN.
 *
 * This adapter is the only component that touches AWS services.
 * The shared protocol layer in @kitstack/sdk/server is agnostic.
 */

import type {
  KitServerAdapter,
  ResolvedKit,
  ResolvedView,
} from "../../../sdk/src/server/types";
import type { KitRegistryItem, UserKitDbItem, KitToolResult } from "./types";
import { dispatchToolCall } from "./tool-dispatcher";
import { getKitApps, getKitShellS3Key, readAppResource } from "./app-resources";
import { kitCdnUrl, demoInternalSecret, demoOrgId, demoVoiceServiceUrl } from "../config";
import { SignJWT } from "jose";
import { createDebriefTools } from "../../../../kits/debrief/src/tools";
import platformKit from "../../../../kits/platform/kit.config";
import {
  createPlatformDataSource,
  type PlatformDataSource,
} from "../../../../kits/platform/src/plugins/platform-data";
import { zodToJsonSchema } from "../../../sdk/src/runtime/zod-to-json-schema";
import { parseTraceparent, traceparentFromIds } from "./trace-context";
import { interactiveIdentity, type McpRequestIdentity } from "./authz";
import { createRouterPlatformDataSource } from "./platform-host";
import { createKitContext } from "../../../sdk/src/context";
import { createDispatchEnvelope, dispatch } from "../../../sdk/src/server/dispatch";
import type { KitContext, ToolDefinition } from "../../../sdk/src/types";
import { getTursoDb } from "./authz";

const APP_SHELL_URI = "ui://kitstack/app";
const DEBRIEF_KIT_ID = "debrief";
const PLATFORM_KIT_ID = "platform";
/** Published by kits/debrief/scripts/publish-assets.ts to KitAssets. */
export const DEBRIEF_SHELL_S3_KEY = "apps/kits/debrief/shell.html";
const INTERNAL_TOKEN_TTL_SECONDS = 60;
const VOICE_REQUEST_TIMEOUT_MS = 8_000;

/**
 * Metadata exposed by the virtual debrief bridge.
 *
 * The generated kit bundle is the source of truth for the View implementations,
 * but the cloud router must still advertise all Views before it can load the
 * bundle. Keeping this contract here also lets the bridge work when registry
 * seeding is delayed or unavailable during a deploy.
 */
export const DEBRIEF_VIEW_METADATA: ResolvedView[] = [
  {
    slug: "prebrief",
    name: "Sales Prebrief",
    description: "before the scheduled sales call, to review customer context, history, objective, timing, and privacy status",
  },
  {
    slug: "confirmation",
    name: "Debrief Confirmation",
    description: "after the call, to review and edit the structured debrief before saving confirmed events",
  },
  {
    slug: "customer-timeline",
    name: "Customer Timeline",
    description: "after confirmation, to review the customer's newest structured events",
  },
];

const DEBRIEF_TOOLS = createDebriefTools().map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: schemaForMcp(tool.args),
}));

const DEBRIEF_KIT: ResolvedKit = {
  id: DEBRIEF_KIT_ID,
  name: "Sales Debrief",
  description: "Prepare, conduct, confirm, and teach a short sales voice debrief.",
  triggers: ["sales", "debrief", "voice", "customer", "follow-up"],
  instructions: "Use the injected demo debrief service; never retain call transcripts or audio.",
  tools: DEBRIEF_TOOLS,
  // T-0195 supplies these from the published View bundle. Keeping the source
  // injectable lets the router bridge land before the bundle is built.
  views: [],
};

export interface PlatformAdapterRequestContext {
  requestId?: string;
  sessionId?: string;
  traceId?: string;
  parentId?: string;
  traceparent?: string;
  identity?: McpRequestIdentity;
}

export interface PlatformAdapterDeps {
  getAllTools: () => Promise<KitRegistryItem[]>;
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>;
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>;
  /** Voice service base URL. Omit to use the linked SST environment value. */
  voiceServiceUrl?: string | (() => string);
  /** Internal signing secret. Omit to use the linked SST secret. */
  voiceInternalSecret?: Uint8Array | (() => Uint8Array);
  /** View metadata and shell source are supplied by T-0195. */
  debriefViews?: ResolvedView[];
  getDebriefShellHtml?: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  requestContext?: PlatformAdapterRequestContext;
  /** Host-bound platform source. Defaults to the router's concrete readers. */
  platformDataSource?: PlatformDataSource;
  /** Test/self-hosted database binding for in-process platform tools. */
  platformDb?: KitContext["db"];
}

/**
 * Create a platform adapter for the KitStack cloud.
 */
export function platformAdapter(deps: PlatformAdapterDeps): KitServerAdapter {
  const {
    getAllTools,
    getUserKitDbs,
    invokeKitLambda,
    debriefViews,
    getDebriefShellHtml,
    fetch: fetcher = globalThis.fetch,
    requestContext,
  } = deps;

  const platformDataSource = deps.platformDataSource ?? createRouterPlatformDataSource({
    fetch: fetcher,
    voiceServiceUrl: resolveString(deps.voiceServiceUrl, demoVoiceServiceUrl),
    voiceInternalSecret: resolveSecret(deps.voiceInternalSecret, demoInternalSecret),
  });

  const debriefKit: ResolvedKit = {
    ...DEBRIEF_KIT,
    views: [...(debriefViews ?? DEBRIEF_VIEW_METADATA)],
  };

  return {
    async resolveUserKits(userId: string): Promise<ResolvedKit[]> {
      const [allTools, userDbs] = await Promise.all([
        getAllTools(),
        getUserKitDbs(userId),
      ]);

      const activatedKitIds = new Set(userDbs.map((db) => db.kitId));
      const kits = new Map<string, ResolvedKit>([
        [DEBRIEF_KIT_ID, debriefKit],
        [PLATFORM_KIT_ID, resolvedPlatformKit()],
      ]);

      for (const tool of allTools) {
        if (tool.kitId === DEBRIEF_KIT_ID) continue;
        if (!activatedKitIds.has(tool.kitId)) continue;
        if (tool.toolName.startsWith("kitstack_")) continue;

        const existing = kits.get(tool.kitId);
        if (existing) {
          existing.tools.push({
            name: tool.toolName,
            description: tool.toolDescription,
            inputSchema: JSON.parse(tool.inputSchema || "{}"),
          });
        } else {
          let triggers: string[] = [];
          try {
            triggers = JSON.parse(tool.kitTriggers || "[]");
          } catch {}

          kits.set(tool.kitId, {
            id: tool.kitId,
            name: tool.kitName,
            description: tool.kitDescription || tool.kitName,
            triggers,
            instructions: tool.kitInstructions || null,
            tools: [{
              name: tool.toolName,
              description: tool.toolDescription,
              inputSchema: JSON.parse(tool.inputSchema || "{}"),
            }],
            views: [], // populated below
          });
        }
      }

      // Populate views for each kit
      for (const [kitId, kit] of kits) {
        // First-party platform Views come from the platform kit manifest, not
        // from Dynamo app rows. External kits continue to resolve their
        // published app metadata here.
        if (kitId === DEBRIEF_KIT_ID || kitId === PLATFORM_KIT_ID) continue;
        const apps = await getKitApps(kitId);
        kit.views = apps.map((a) => ({
          slug: a.slug,
          name: a.name,
          description: a.description || a.name,
        }));
      }

      return Array.from(kits.values());
    },

    async executeTool(
      kitId: string,
      toolName: string,
      args: Record<string, unknown>,
      userId: string
    ): Promise<KitToolResult> {
      if (kitId === PLATFORM_KIT_ID) {
        return executePlatformTool(platformDataSource, platformKit.tools, toolName, args, userId, deps.platformDb, requestContext);
      }
      if (kitId === DEBRIEF_KIT_ID) {
        return callDebriefVoiceService({
          operation: "tool",
          name: toolName,
          args,
          userId,
          voiceServiceUrl: resolveString(deps.voiceServiceUrl, demoVoiceServiceUrl),
          voiceInternalSecret: resolveSecret(deps.voiceInternalSecret, demoInternalSecret),
          orgId: demoOrgId(),
          fetcher,
          requestContext,
        });
      }

      return dispatchToolCall(
        toolName,
        args,
        userId,
        getAllTools,
        invokeKitLambda,
        requestContext,
      );
    },

    async executeLoader(
      kitId: string,
      viewSlug: string,
      userId: string
    ): Promise<unknown> {
      if (kitId === PLATFORM_KIT_ID) {
        const view = platformKit.views?.find((candidate) => candidate.slug === viewSlug);
        if (!view) throw new Error(`Unknown platform View "${viewSlug}"`);
        return view.loader(platformContext(platformDataSource, userId, deps.platformDb, requestContext, { orgId: demoOrgId() }));
      }
      if (kitId === DEBRIEF_KIT_ID) {
        const result = await callDebriefVoiceService({
          operation: "view",
          name: "kit_view",
          args: { id: DEBRIEF_KIT_ID, view: viewSlug },
          userId,
          voiceServiceUrl: resolveString(deps.voiceServiceUrl, demoVoiceServiceUrl),
          voiceInternalSecret: resolveSecret(deps.voiceInternalSecret, demoInternalSecret),
          orgId: demoOrgId(),
          fetcher,
          requestContext,
        });
        return unwrapToolData(result);
      }

      const allTools = await getAllTools();
      const { getKitFunctionId } = await import("./kit-resources");
      const { getUserKitDb } = await import("../db/dynamo");

      const functionId = getKitFunctionId(kitId, allTools);
      if (!functionId) throw new Error(`No Lambda for kit "${kitId}"`);

      const userDb = await getUserKitDb(userId, kitId);
      if (!userDb) throw new Error(`DB not provisioned for kit "${kitId}"`);

      const result = await invokeKitLambda(functionId, {
        loaderSlug: viewSlug,
        userId,
        kitId,
        dbUrl: userDb.dbUrl,
        dbToken: userDb.dbToken,
        ...invocationTraceFields(requestContext),
      }) as any;

      return result?.data ?? null;
    },

    async getShellHtml(kitId: string): Promise<string> {
      if (kitId === PLATFORM_KIT_ID) {
        const resource = await readAppResource(APP_SHELL_URI, "system", new Set([PLATFORM_KIT_ID]));
        return resource?.text || "";
      }
      if (kitId === DEBRIEF_KIT_ID) {
        if (getDebriefShellHtml) {
          return getDebriefShellHtml();
        }

        const resource = await readAppResource(
          APP_SHELL_URI,
          "system",
          new Set([DEBRIEF_KIT_ID]),
          DEBRIEF_SHELL_S3_KEY,
        );
        if (!resource?.text) {
          throw new Error("Sales debrief View shell is not published yet (T-0195)");
        }
        return resource.text;
      }

      const shellS3Key = await getKitShellS3Key(kitId);
      const resource = await readAppResource(APP_SHELL_URI, "system", new Set([kitId]), shellS3Key);
      return resource?.text || "";
    },

    getCdnUrl(): string {
      return kitCdnUrl();
    },
  };
}

function resolvedPlatformKit(): ResolvedKit {
  return {
    id: PLATFORM_KIT_ID,
    name: platformKit.name,
    description: platformKit.description,
    triggers: platformKit.triggers ?? [],
    instructions: platformKit.instructions || null,
    tools: platformKit.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: schemaForMcp(tool.args),
    })),
    views: (platformKit.views ?? []).map((view) => ({
      slug: view.slug,
      name: view.name,
      description: view.description,
    })),
  };
}

async function executePlatformTool(
  source: PlatformDataSource,
  tools: readonly ToolDefinition[],
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  db: KitContext["db"] | undefined,
  requestContext: PlatformAdapterRequestContext | undefined,
): Promise<KitToolResult> {
  const tool = tools.find((candidate) => candidate.name === toolName);
  const identity = requestContext?.identity ?? interactiveIdentity(userId);
  const envelope = createDispatchEnvelope({
    kitId: PLATFORM_KIT_ID,
    command: toolName,
    args,
    principal: identity.principal,
    context: {
      actor: identity.actor,
      ...(identity.delegation ? { delegation: identity.delegation } : {}),
      channel: { kind: "mcp", id: "kitstack.mcp" },
      session: sessionFor(requestContext),
    },
  });
  const target = tool ? {
    kitId: PLATFORM_KIT_ID,
    command: toolName,
    validate(input: Record<string, unknown>) {
      const parsed = tool.args.safeParse(input);
      return parsed.success
        ? { success: true as const, data: parsed.data as Record<string, unknown> }
        : { success: false as const, message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ") };
    },
    authorize: tool.authorize
      ? (input: Record<string, unknown>, ctx: KitContext) => tool.authorize!(input, ctx)
      : undefined,
  } : undefined;

  return dispatch(envelope, {
    resolve: async () => target
      ? { target }
      : { error: { code: "unknown_tool", message: `Unknown platform tool: "${toolName}"` } },
    createContext: () => platformContext(source, userId, db, requestContext),
    checkGrant: async (_request, requirements, ctx) => {
      for (const requirement of requirements) {
        if (!(await source.authorize(requirement, ctx!))) {
          return { allowed: false, reason: `Forbidden: missing "${requirement.relation}" on ${requirement.objectType} "${requirement.objectId}"` };
        }
      }
      return { allowed: true };
    },
    invoke: async (_request, _target, parsedArgs, ctx) => tool!.handler!(ctx!, parsedArgs),
  });
}

function platformContext(
  source: PlatformDataSource,
  userId: string,
  db: KitContext["db"] | undefined,
  requestContext: PlatformAdapterRequestContext | undefined,
  params: Readonly<Record<string, unknown>> = {},
): KitContext {
  const identity = requestContext?.identity ?? interactiveIdentity(userId);
  return createKitContext({
    db: db ?? getTursoDb(),
    params,
    connectors: {
      get: <T>(id: string) => id === "platform.data" ? source as T : undefined,
      require: <T>(id: string) => {
        if (id !== "platform.data") throw new Error(`Connector "${id}" is not registered`);
        return source as T;
      },
      has: (id: string) => id === "platform.data",
    },
    identity: {
      principal: identity.principal,
      actor: identity.actor,
      ...(identity.delegation ? { delegation: identity.delegation } : {}),
    },
    channel: { kind: "mcp", id: "kitstack.mcp" },
    session: sessionFor(requestContext),
  });
}

function sessionFor(requestContext?: PlatformAdapterRequestContext): { id: string; traceId: string; parentId?: string } {
  const id = requestContext?.sessionId?.trim() || requestContext?.requestId?.trim() || `mcp-${crypto.randomUUID()}`;
  const traceId = requestContext?.traceId?.trim() || id;
  return {
    id,
    traceId,
    ...(requestContext?.parentId?.trim() ? { parentId: requestContext.parentId.trim() } : {}),
  };
}

interface DebriefVoiceCallInput {
  operation: "tool" | "view";
  name: string;
  args: Record<string, unknown>;
  userId: string;
  voiceServiceUrl: string;
  voiceInternalSecret: Uint8Array;
  orgId: string;
  fetcher: typeof globalThis.fetch;
  requestContext?: PlatformAdapterRequestContext;
}

async function callDebriefVoiceService(input: DebriefVoiceCallInput): Promise<KitToolResult> {
  if (!input.voiceServiceUrl) return voiceError("Sales debrief voice service is not configured");
  if (input.voiceInternalSecret.byteLength < 32) {
    return voiceError("Sales debrief voice service signing is not configured");
  }
  if (!input.fetcher) return voiceError("Sales debrief voice service cannot be reached from this runtime");

  const requestId = input.requestContext?.requestId?.trim() || `mcp-${crypto.randomUUID()}`;
  const traceId = input.requestContext?.traceId?.trim() || requestId;
  const parentId = input.requestContext?.parentId?.trim();
  const traceparent = parseTraceparent(input.requestContext?.traceparent)?.traceparent
    ?? traceparentFromIds(traceId, parentId);
  const token = await new SignJWT({
    org: input.orgId,
    kit: DEBRIEF_KIT_ID,
    req: requestId,
    trace: traceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setExpirationTime(Math.floor(Date.now() / 1000) + INTERNAL_TOKEN_TTL_SECONDS)
    .sign(input.voiceInternalSecret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
  try {
    const response = await input.fetcher(`${input.voiceServiceUrl.replace(/\/$/, "")}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-trace-id": traceId,
        ...(input.requestContext?.sessionId ? { "x-session-id": input.requestContext.sessionId } : {}),
        ...(parentId ? { "x-parent-id": parentId } : {}),
        ...(traceparent ? { traceparent } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: {
          name: input.name,
          arguments: input.args,
        },
      }),
      signal: controller.signal,
    });

    const body = await readJson(response);
    if (!response.ok) {
      const message = errorMessage(body) || `voice service returned HTTP ${response.status}`;
      return voiceError(`Sales debrief voice service unavailable: ${message}`);
    }
    if (body?.error) return voiceError(`Sales debrief request failed: ${body.error.message || "unknown error"}`);

    const result = body?.result ?? body;
    if (!result || !Array.isArray(result.content)) {
      return voiceError("Sales debrief voice service returned an invalid MCP result");
    }
    return result as KitToolResult;
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "request timed out"
      : error instanceof Error ? error.message : String(error);
    return voiceError(`Sales debrief voice service unavailable: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Fields understood by the generated kit Lambda handler's KitContext bridge. */
function invocationTraceFields(
  context?: PlatformAdapterRequestContext,
): Record<string, string> {
  return {
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context?.traceId ? { traceId: context.traceId } : {}),
    ...(context?.parentId ? { parentId: context.parentId } : {}),
  };
}

async function readJson(response: Response): Promise<any> {
  try { return await response.json(); } catch { return null; }
}

function errorMessage(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error.message === "string") return body.error.message;
  return null;
}

function unwrapToolData(result: KitToolResult): unknown {
  const text = result.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return result;
  try {
    const parsed = JSON.parse(text.text);
    return parsed?.data ?? parsed;
  } catch {
    return text.text;
  }
}

function voiceError(message: string): KitToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function resolveString(value: string | (() => string) | undefined, fallback: () => string): string {
  return typeof value === "function" ? value() : value ?? fallback();
}

function resolveSecret(value: Uint8Array | (() => Uint8Array) | undefined, fallback: () => Uint8Array): Uint8Array {
  return typeof value === "function" ? value() : value ?? fallback();
}

function schemaForMcp(schema: any): Record<string, unknown> {
  // Zod 4 exposes the standard JSON Schema conversion directly. The SDK
  // fallback remains for the Zod 3 schemas used by existing registry kits.
  const converted = typeof schema?.toJSONSchema === "function"
    ? schema.toJSONSchema()
    : zodToJsonSchema(schema);
  return removeDefaultedRequired(converted);
}

function removeDefaultedRequired(schema: Record<string, any>): Record<string, any> {
  const result = { ...schema };
  if (result.properties && result.required) {
    result.required = result.required.filter(
      (name: string) => result.properties[name]?.default === undefined,
    );
    if (result.required.length === 0) delete result.required;
  }
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([name, value]) => [
        name,
        value && typeof value === "object" ? removeDefaultedRequired(value as Record<string, any>) : value,
      ]),
    );
  }
  if (result.items && typeof result.items === "object") {
    result.items = removeDefaultedRequired(result.items);
  }
  return result;
}
