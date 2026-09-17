import type { KitToolResult } from "../types";
import type { KitServerAdapter, ResolvedKit } from "./types";

/**
 * Provider-neutral manifest for a registered, bring-your-own MCP server.
 *
 * The manifest is deliberately data-only: it lets KitStack expose a server's
 * tools through the kit() surface without requiring that server to import the
 * SDK. The MCP server remains responsible for executing tools/call.
 */
export interface McpServerManifest {
  readonly apiVersion: "kitstack.dev/v1alpha1";
  readonly kind: "McpServer";
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly namespace?: string;
  readonly tools: readonly McpServerToolManifest[];
}

export interface McpServerToolManifest {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly permissionClass: "read" | "write" | "admin";
  readonly locked?: boolean;
  readonly memoryNamespaces?: readonly string[];
}

export interface McpPassthroughCall {
  readonly serverId: string;
  readonly request: {
    readonly method: "tools/call";
    readonly params: {
      readonly name: string;
      readonly arguments: Record<string, unknown>;
    };
  };
}

export interface McpServerCallContext {
  readonly userId: string;
}

/** Host-owned registration for a remote or local MCP server. */
export interface McpServerRegistration {
  readonly manifest: McpServerManifest;
  readonly call: (
    request: McpPassthroughCall["request"],
    context: McpServerCallContext,
  ) => Promise<KitToolResult>;
}

export class McpManifestError extends Error {
  readonly code:
    | "MCP_MANIFEST_INVALID"
    | "MCP_MANIFEST_DUPLICATE_TOOL"
    | "MCP_MANIFEST_UNKNOWN_TOOL";

  constructor(
    code: McpManifestError["code"],
    message: string,
  ) {
    super(message);
    this.name = "McpManifestError";
    this.code = code;
  }
}

/** Validate and freeze the data boundary before registering an MCP server. */
export function parseMcpServerManifest(input: unknown): McpServerManifest {
  if (!isRecord(input)) invalid("manifest must be an object");
  if (input.apiVersion !== "kitstack.dev/v1alpha1") invalid("apiVersion must be kitstack.dev/v1alpha1");
  if (input.kind !== "McpServer") invalid("kind must be McpServer");

  const id = requiredString(input.id, "id");
  const name = requiredString(input.name, "name");
  const version = requiredString(input.version, "version");
  if (!Array.isArray(input.tools)) invalid("tools must be an array");

  const seen = new Set<string>();
  const tools = input.tools.map((tool, index) => {
    if (!isRecord(tool)) invalid(`tools[${index}] must be an object`);
    const toolName = requiredString(tool.name, `tools[${index}].name`);
    if (seen.has(toolName)) {
      throw new McpManifestError("MCP_MANIFEST_DUPLICATE_TOOL", `Tool "${toolName}" is declared more than once`);
    }
    seen.add(toolName);
    const description = requiredString(tool.description, `tools[${index}].description`);
    const permissionClass = tool.permissionClass;
    if (permissionClass !== "read" && permissionClass !== "write" && permissionClass !== "admin") {
      invalid(`tools[${index}].permissionClass must be read, write, or admin`);
    }
    if (!isRecord(tool.inputSchema)) invalid(`tools[${index}].inputSchema must be an object`);
    const memoryNamespaces = tool.memoryNamespaces === undefined
      ? undefined
      : stringArray(tool.memoryNamespaces, `tools[${index}].memoryNamespaces`);
    return Object.freeze({
      name: toolName,
      description,
      inputSchema: Object.freeze({ ...tool.inputSchema }),
      permissionClass,
      ...(typeof tool.locked === "boolean" ? { locked: tool.locked } : {}),
      ...(memoryNamespaces ? { memoryNamespaces: Object.freeze(memoryNamespaces) } : {}),
    });
  });

  return Object.freeze({
    apiVersion: input.apiVersion,
    kind: input.kind,
    id,
    name,
    version,
    ...(typeof input.description === "string" ? { description: input.description } : {}),
    ...(typeof input.namespace === "string" ? { namespace: input.namespace } : {}),
    tools: Object.freeze(tools),
  });
}

/** Map the kit shell command to the registered server's native MCP call. */
export function resolveMcpPassthrough(
  manifest: McpServerManifest,
  toolName: string,
  args: Record<string, unknown> = {},
): McpPassthroughCall {
  const tool = manifest.tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    throw new McpManifestError(
      "MCP_MANIFEST_UNKNOWN_TOOL",
      `Unknown tool "${toolName}" for MCP server "${manifest.id}"`,
    );
  }
  return {
    serverId: manifest.id,
    request: {
      method: "tools/call",
      params: { name: tool.name, arguments: { ...args } },
    },
  };
}

/**
 * Add registered MCP servers to an existing SDK server adapter.
 *
 * The base adapter remains responsible for SDK-built kits. Registered servers
 * contribute only their manifest metadata and native tools/call execution.
 */
export function withMcpServers(
  adapter: KitServerAdapter,
  registrations: readonly McpServerRegistration[],
): KitServerAdapter {
  const servers = new Map<string, McpServerRegistration>();
  for (const registration of registrations) {
    if (servers.has(registration.manifest.id)) {
      throw new McpManifestError(
        "MCP_MANIFEST_INVALID",
        `MCP server "${registration.manifest.id}" is registered more than once`,
      );
    }
    servers.set(registration.manifest.id, registration);
  }

  return {
    async resolveUserKits(userId: string): Promise<ResolvedKit[]> {
      const kits = await adapter.resolveUserKits(userId);
      const existing = new Set(kits.map((kit) => kit.id));
      const passthrough = [...servers.values()].map(({ manifest }) => {
        if (existing.has(manifest.id)) {
          throw new McpManifestError(
            "MCP_MANIFEST_INVALID",
            `MCP server "${manifest.id}" conflicts with an existing kit`,
          );
        }
        return resolvedMcpKit(manifest);
      });
      return [...kits, ...passthrough];
    },

    async executeTool(kitId, toolName, args, userId): Promise<KitToolResult> {
      const registration = servers.get(kitId);
      if (!registration) return adapter.executeTool(kitId, toolName, args, userId);
      const passthrough = resolveMcpPassthrough(registration.manifest, toolName, args);
      return registration.call(passthrough.request, { userId });
    },

    executeLoader: (kitId, viewSlug, userId) => adapter.executeLoader(kitId, viewSlug, userId),
    getShellHtml: (kitId) => adapter.getShellHtml(kitId),
    ...(adapter.getCdnUrl ? { getCdnUrl: () => adapter.getCdnUrl!() } : {}),
  };
}

function resolvedMcpKit(manifest: McpServerManifest): ResolvedKit {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? `Registered MCP server ${manifest.name}`,
    triggers: [],
    instructions: null,
    tools: manifest.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
    views: [],
  };
}

function invalid(message: string): never {
  throw new McpManifestError("MCP_MANIFEST_INVALID", message);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    invalid(`${field} must be an array of non-empty strings`);
  }
  return [...value] as string[];
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
