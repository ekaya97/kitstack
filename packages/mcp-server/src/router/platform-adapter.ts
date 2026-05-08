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
} from "../../../sdk/src/server/types";
import type { KitRegistryItem, UserKitDbItem, KitToolResult } from "./types";
import { dispatchToolCall } from "./tool-dispatcher";
import { getKitApps, getKitShellS3Key, readAppResource } from "./app-resources";
import { kitCdnUrl } from "../config";

const APP_SHELL_URI = "ui://kitstack/app";

export interface PlatformAdapterDeps {
  getAllTools: () => Promise<KitRegistryItem[]>;
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>;
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>;
}

/**
 * Create a platform adapter for the KitStack cloud.
 */
export function platformAdapter(deps: PlatformAdapterDeps): KitServerAdapter {
  const { getAllTools, getUserKitDbs, invokeKitLambda } = deps;

  return {
    async resolveUserKits(userId: string): Promise<ResolvedKit[]> {
      const [allTools, userDbs] = await Promise.all([
        getAllTools(),
        getUserKitDbs(userId),
      ]);

      const activatedKitIds = new Set(userDbs.map((db) => db.kitId));
      const kits = new Map<string, ResolvedKit>();

      for (const tool of allTools) {
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
      return dispatchToolCall(
        toolName,
        args,
        userId,
        getAllTools,
        invokeKitLambda
      );
    },

    async executeLoader(
      kitId: string,
      viewSlug: string,
      userId: string
    ): Promise<unknown> {
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
      }) as any;

      return result?.data ?? null;
    },

    async getShellHtml(kitId: string): Promise<string> {
      const shellS3Key = await getKitShellS3Key(kitId);
      const resource = await readAppResource(APP_SHELL_URI, "system", new Set([kitId]), shellS3Key);
      return resource?.text || "";
    },

    getCdnUrl(): string {
      return kitCdnUrl();
    },
  };
}
