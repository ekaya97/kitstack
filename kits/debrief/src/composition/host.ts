import { existsSync, readFileSync } from "node:fs";
import { createKitServer, type HttpRouteRequest, type KitServer, type RequestAuthentication, type ServeOptions } from "@kitstackco/sdk/server";
import { drizzle } from "drizzle-orm/libsql";
import { authenticateMcpRequest, McpAuthError } from "../adapters/auth/mcp.js";
import { createBoundDebriefKit } from "./kit.js";
import type { DemoApp } from "./app/index.js";

type HostOptions = Omit<ServeOptions, "kit" | "kits" | "db" | "databases">;

/**
 * The debrief kit on the KitStack server: one tool and View definition for
 * MCP over HTTP or stdio, with dispatch validation, authorization and
 * telemetry. Transports add only their own routes and channels.
 */
export function createDebriefKitServer(
  app: DemoApp,
  options: HostOptions = {},
  kit: ReturnType<typeof createBoundDebriefKit> = createBoundDebriefKit(app),
): KitServer {
  return createKitServer({
    kit,
    db: drizzle(app.client),
    shellHtml: readBuiltShell(),
    ...(options.transport === "http" ? { mcpPath: "/mcp", authenticate: (request: HttpRouteRequest) => authenticateDebriefMcp(app, request) } : {}),
    ...options,
  });
}

/** An authenticated debrief caller: the user (MCP principal) and the organization it acts in. */
export interface DebriefTenantAuthentication {
  userId: string;
  orgId: string;
}

/**
 * MCP auth for the debrief host: none (loopback), app tokens, or router-signed
 * service tokens. The verified organization is bound to the principal, so the
 * kit's tools and Views run in that organization's workspace.
 */
export async function authenticateDebriefMcp(
  app: DemoApp,
  request: Pick<HttpRouteRequest, "headers">,
): Promise<RequestAuthentication> {
  const result = await authenticateDebriefTenant(app, request);
  return "status" in result ? result : { userId: result.userId };
}

/**
 * Authenticate a request and resolve its organization: the signed `org`
 * claim, the app token's organization, or the operator organization when
 * auth is off (loopback development).
 */
export async function authenticateDebriefTenant(
  app: DemoApp,
  request: Pick<HttpRouteRequest, "headers">,
): Promise<DebriefTenantAuthentication | Exclude<RequestAuthentication, { userId: string }>> {
  try {
    const context = await authenticateMcpRequest(new Request("http://demo.local/mcp", {
      method: "POST",
      headers: Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, value] as [string, string]]),
    }), { mode: app.mcpAuthMode, registry: app.apps });
    const subject = (context as { claims?: { sub?: unknown } }).claims?.sub;
    const userId = typeof subject === "string" && subject ? subject : context.appId ?? "default-user";
    const orgId = context.org ?? app.tenants.operatorOrgId;
    if (context.org) app.tenants.bindPrincipal(userId, context.org);
    return { userId, orgId };
  } catch (error) {
    if (!(error instanceof McpAuthError)) return { status: 401, body: { error: "mcp_auth_misconfigured" } };
    const status = error.code === "insufficient_scope" || error.code === "forbidden_identity" ? 403 : 401;
    return {
      status,
      body: { error: error.code, message: error.message },
      ...(status === 401 ? { headers: { "www-authenticate": "Bearer" } } : {}),
    };
  }
}

/** The built View shell, so kit_view can render Views once the kit has been built. */
function readBuiltShell(): string | undefined {
  const path = new URL("../../.kitstack/build/shell.html", import.meta.url);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}
