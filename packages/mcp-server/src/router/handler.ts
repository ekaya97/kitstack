import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getOAuthMetadata } from "./oauth/metadata";
import { handleRegister } from "./oauth/register";
import { validateAuthorizeRequest, storeAuthorizeSession, issueAuthCode } from "./oauth/authorize";
import { handleTokenExchange } from "./oauth/token";
import { verifyAccessToken } from "./oauth/helpers";
import { handleMcpRequest } from "./mcp-protocol";
import { getAllRegistryItems, getUserKitDbs } from "../db/dynamo";
import { mcpRequireAuthorized } from "./authz";
import { audit } from "./audit";
import { log, flushLogs } from "./logger";
import {
  getOAuthItem,
  putOAuthItem,
  deleteOAuthItem,
} from "./oauth-store";
import {
  mcpAllowedOrigins,
  mcpAuthStoreTable,
  mcpInternalApiKey,
  betterAuthUrl,
  devRelayUrl,
  mcpPublicUrl,
} from "../config";
import type { JsonRpcRequest } from "./types";

const lambda = new LambdaClient({});
const dynamo = new DynamoDBClient({});

function serverUrlFromEvent(event: APIGatewayProxyEventV2): string {
  const publicUrl = mcpPublicUrl();
  if (publicUrl) return publicUrl;
  return `https://${event.requestContext.domainName}`;
}

const ALLOWED_ORIGINS = mcpAllowedOrigins();

function getAllowedOrigin(requestOrigin: string | undefined): string {
  if (!requestOrigin) return ALLOWED_ORIGINS[0];
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
}

function json(body: unknown, status = 200, origin?: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getAllowedOrigin(origin),
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Vary": "Origin",
    },
    body: JSON.stringify(body),
  };
}

async function invokeKitLambda(arn: string, payload: unknown): Promise<unknown> {
  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: arn,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  );
  if (response.Payload) {
    return JSON.parse(Buffer.from(response.Payload).toString());
  }
  throw new Error("Kit Lambda returned no payload");
}

// --- Rate Limiting (DynamoDB-backed, per-userId, sliding window) ---

const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX_REQUESTS = 120; // 120 requests per minute per user (session loads re-trigger artifacts)

async function checkRateLimit(userId: string): Promise<boolean> {
  const oauthTable = mcpAuthStoreTable();
  if (!oauthTable) return false; // fail-closed if table not configured

  const windowKey = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC);
  const pk = `RATE#${userId}#${windowKey}`;

  try {
    const result = await dynamo.send(
      new UpdateItemCommand({
        TableName: oauthTable,
        Key: {
          pk: { S: pk },
          sk: { S: "COUNTER" },
        },
        UpdateExpression: "SET #cnt = if_not_exists(#cnt, :zero) + :one, #ttl = :ttl",
        ExpressionAttributeNames: { "#cnt": "cnt", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":zero": { N: "0" },
          ":one": { N: "1" },
          ":ttl": { N: String(Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW_SEC * 2) },
        },
        ReturnValues: "ALL_NEW",
      })
    );

    const count = parseInt(result.Attributes?.cnt?.N || "0", 10);
    return count <= RATE_LIMIT_MAX_REQUESTS;
  } catch (err) {
    console.error("[RateLimit] DynamoDB error — failing closed:", err);
    return false; // fail-closed: reject request if rate limiter is unavailable
  }
}

// --- DB Proxy types (for sandboxed kit Lambda-to-Lambda invocations) ---

interface DbProxyEvent {
  __dbProxy: true;
  invocationToken: string;
  sql?: string;
  args?: unknown[];
  batch?: Array<{ sql: string; args?: unknown[] }>;
}

interface DbProxyResult {
  columns?: string[];
  rows?: unknown[][];
  rowsAffected?: number;
  lastInsertRowid?: bigint | number;
  results?: unknown[];
  error?: string;
}

/**
 * Handle a DB proxy request from a sandboxed kit Lambda.
 * Validates the invocation token, connects to the kit's Turso DB,
 * and executes the SQL query on behalf of the kit.
 */
async function handleDbProxy(event: DbProxyEvent): Promise<DbProxyResult> {
  const { invocationToken, sql, args, batch } = event;

  // 1. Look up cached DB credentials from the invocation token
  const cached = await getOAuthItem(`INVOCATION#${invocationToken}`, "DB_CREDS");
  if (!cached) {
    return { error: "INVALID_TOKEN" };
  }

  let creds: { dbUrl: string; dbToken: string; userId: string; kitId: string };
  try {
    creds = JSON.parse(cached.data ?? "{}");
  } catch {
    return { error: "CORRUPT_TOKEN_DATA" };
  }

  if (!creds.dbUrl) {
    return { error: "MISSING_DB_URL" };
  }

  // 2. Connect to the kit's Turso database
  const { createClient: createTursoClient } = await import("@libsql/client");
  const client = createTursoClient({ url: creds.dbUrl, authToken: creds.dbToken });

  try {
    // 3. Execute query or batch
    if (batch) {
      const results = [];
      for (const stmt of batch) {
        const result = await client.execute({ sql: stmt.sql, args: (stmt.args ?? []) as any });
        results.push({
          columns: result.columns,
          rows: result.rows as any,
          rowsAffected: result.rowsAffected,
        });
      }
      return { results };
    }

    if (sql) {
      const result = await client.execute({ sql, args: (args ?? []) as any });
      return {
        columns: result.columns,
        rows: result.rows as any,
        rowsAffected: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid,
      };
    }

    return { error: "MISSING_SQL" };
  } catch (err: any) {
    log.error("DB proxy query error", { error: err.message, kitId: creds.kitId });
    return { error: `QUERY_ERROR: ${err.message}` };
  } finally {
    client.close();
  }
}

export async function handler(
  event: APIGatewayProxyEventV2 | DbProxyEvent
): Promise<APIGatewayProxyStructuredResultV2 | DbProxyResult> {
  // ── DB Proxy path (Lambda-to-Lambda from sandboxed kits) ──
  if ((event as any).__dbProxy) {
    return handleDbProxy(event as DbProxyEvent);
  }

  // From here on, event is guaranteed to be an HTTP API Gateway event
  // (the __dbProxy branch returned early above)
  const httpEvent = event as APIGatewayProxyEventV2;
  const method = httpEvent.requestContext.http.method;
  const path = httpEvent.rawPath;
  const origin = httpEvent.headers.origin;

  // CORS preflight
  if (method === "OPTIONS") {
    return json({}, 204, origin);
  }

  try {
    // --- OAuth Endpoints ---

    if (path === "/.well-known/oauth-authorization-server") {
      return json(getOAuthMetadata(serverUrlFromEvent(httpEvent)), 200, origin);
    }

    if (path === "/register" && method === "POST") {
      const body = safeParseBody(httpEvent.body, httpEvent.headers["content-type"]);
      if (!body) return json({ error: "Invalid request body" }, 400, origin);
      const result = await handleRegister(body, putOAuthItem);
      return json(result, 201, origin);
    }

    if (path === "/authorize" && method === "GET") {
      const params = httpEvent.queryStringParameters || {};
      const authorizeParams = {
        response_type: params.response_type || "",
        client_id: params.client_id || "",
        redirect_uri: params.redirect_uri || "",
        code_challenge: params.code_challenge || "",
        code_challenge_method: params.code_challenge_method || "S256",
        state: params.state,
      };

      const validation = await validateAuthorizeRequest(authorizeParams, getOAuthItem);

      if (!validation.valid) {
        return json({ error: validation.error }, 400, origin);
      }

      // Store params server-side to prevent tampering during login redirect
      const sessionId = await storeAuthorizeSession(authorizeParams, putOAuthItem);

      const loginUrl = new URL(`${betterAuthUrl()}/login`);
      loginUrl.searchParams.set("callback", `${serverUrlFromEvent(httpEvent)}/authorize/callback`);
      loginUrl.searchParams.set("session_id", sessionId);

      return {
        statusCode: 302,
        headers: { Location: loginUrl.toString() },
        body: "",
      };
    }

    if (path === "/authorize/callback" && method === "GET") {
      const params = httpEvent.queryStringParameters || {};
      const userId = params.user_id;
      const sessionId = params.session_id;

      if (!userId) {
        audit({ action: "auth.failed", detail: "missing user_id in callback" });
        return json({ error: "Authentication failed" }, 401, origin);
      }
      if (!sessionId) {
        return json({ error: "Missing session_id" }, 400, origin);
      }

      const { code, redirectUri, state } = await issueAuthCode(
        userId,
        sessionId,
        getOAuthItem,
        putOAuthItem,
        deleteOAuthItem
      );

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set("code", code);
      if (state) redirectUrl.searchParams.set("state", state);

      return {
        statusCode: 302,
        headers: { Location: redirectUrl.toString() },
        body: "",
      };
    }

    if (path === "/token" && method === "POST") {
      const rawBody = httpEvent.isBase64Encoded
        ? Buffer.from(httpEvent.body || "", "base64").toString()
        : httpEvent.body;
      const body = safeParseBody(rawBody, httpEvent.headers["content-type"]);
      if (!body) return json({ error: "Invalid request body" }, 400, origin);

      const result = await handleTokenExchange(
        body,
        getOAuthItem,
        putOAuthItem,
        deleteOAuthItem
      );

      audit({
        action: body.grant_type === "refresh_token" ? "auth.token.refreshed" : "auth.token.issued",
      });

      return json(result, 200, origin);
    }

    // --- Token Revocation (RFC 7009) ---

    if (path === "/revoke" && method === "POST") {
      const body = safeParseBody(httpEvent.body);
      if (!body) return json({ error: "Invalid request body" }, 400, origin);

      const token = body.token;
      if (!token || typeof token !== "string") {
        return json({ error: "invalid_request: missing token" }, 400, origin);
      }

      log.debug("Revoke received", { tokenTypeHint: body.token_type_hint ?? "none", tokenPrefix: token.substring(0, 12) });

      // Attempt to delete the refresh token (idempotent — no error if not found)
      try {
        // First, try direct delete assuming it's a refresh token
        await deleteOAuthItem(`REFRESH#${token}`, "TOKEN");
        log.debug("Revoke: deleted refresh token directly");
        audit({ action: "auth.token.revoked" });
      } catch (err: any) {
        log.debug("Revoke: direct refresh delete missed", { error: err.message });
        // If that missed, the client may have sent an access token (JWT).
        // Decode it to get the userId, then purge their refresh tokens.
        try {
          const auth = await verifyAccessToken(token);
          log.debug("Revoke: token is a valid JWT", { userId: auth.userId });
          const oauthTable = mcpAuthStoreTable();
          if (auth.userId && oauthTable) {
            const scan = await dynamo.send(
              new ScanCommand({
                TableName: oauthTable,
                FilterExpression: "begins_with(pk, :prefix) AND sk = :sk",
                ExpressionAttributeValues: {
                  ":prefix": { S: "REFRESH#" },
                  ":sk": { S: "TOKEN" },
                },
                Limit: 50,
              })
            );
            const matchedTokens = [];
            for (const item of scan.Items || []) {
              const parsed = unmarshall(item);
              try {
                const data = JSON.parse(parsed.data);
                if (data.userId === auth.userId) {
                  matchedTokens.push(parsed.pk);
                  await deleteOAuthItem(parsed.pk, parsed.sk);
                }
              } catch { /* skip malformed */ }
            }
            log.debug("Revoke: purged refresh tokens", { count: matchedTokens.length });
            audit({ action: "auth.token.revoked" });
          }
        } catch (jwtErr: any) {
          log.debug("Revoke: token is not a valid JWT either", { error: jwtErr.message });
          // RFC 7009: revocation endpoint always returns 200
        }
      }
      return json({}, 200, origin);
    }

    // --- Connection check (called by the marketing site, requires internal API key) ---

    if (path === "/connected" && method === "GET") {
      const internalKey = mcpInternalApiKey();
      if (internalKey) {
        const providedKey =
          httpEvent.headers["x-internal-api-key"] || httpEvent.queryStringParameters?.api_key;
        if (providedKey !== internalKey) {
          return json({ error: "Unauthorized" }, 401, origin);
        }
      }

      const userId = httpEvent.queryStringParameters?.userId;
      if (!userId) {
        return json({ connected: false, reason: "missing_userId" }, 400, origin);
      }

      const oauthTable = mcpAuthStoreTable();
      if (!oauthTable) {
        return json({ connected: false, reason: "server_config_error" }, 500, origin);
      }

      const STALE_THRESHOLD_MS = 65 * 60 * 1000; // 65 min — just above the 1h access token expiry

      const scan = await dynamo.send(
        new ScanCommand({
          TableName: oauthTable,
          FilterExpression: "begins_with(pk, :prefix) AND sk = :sk",
          ExpressionAttributeValues: {
            ":prefix": { S: "REFRESH#" },
            ":sk": { S: "TOKEN" },
          },
          Limit: 50,
        })
      );

      const now = Date.now();
      const hasActiveToken = (scan.Items || []).some((item) => {
        const parsed = unmarshall(item);
        try {
          const data = JSON.parse(parsed.data);
          if (data.userId !== userId) return false;
          // If refreshedAt is present, check that the token was used recently.
          // An active client refreshes every ~1h when the access token expires.
          if (data.refreshedAt) {
            return now - data.refreshedAt < STALE_THRESHOLD_MS;
          }
          // Legacy tokens without refreshedAt: fall back to existence check
          return true;
        } catch {
          return false;
        }
      });

      return json({ connected: hasActiveToken }, 200, origin);
    }

    // --- Dev Relay ---

    // Dev Relay asset requests (GET /dev/{sessionId}/**)
    // Serves view JS/CSS from the developer's local Vite dev server via WebSocket relay.
    // Vite generates absolute import paths (/src/views/styles.css, /node_modules/...)
    // so we also catch requests without the /dev/ prefix that come from Vite imports.
    // No auth required — these are <script> and <link> tags in the iframe.
    if (path.match(/^\/dev\/[^/]+\//) && method === "GET" && !path.includes(".well-known") && !path.match(/\/(register|authorize|token|revoke)/)) {
      const parts = path.split("/");
      const sessionId = parts[2];
      const assetPath = parts.slice(3).join("/"); // everything after /dev/{sessionId}/

      const corsHeaders = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" };

      const session = await getOAuthItem(`DEV_SESSION#${sessionId}`, "CONNECTION");
      if (!session) return { statusCode: 404, headers: corsHeaders, body: "Dev session not found" };

      const connectionId = (session as any).connectionId as string;
      if (!connectionId) return { statusCode: 502, headers: corsHeaders, body: "Dev session disconnected" };

      const wsEndpoint = devRelayUrl();
      if (!wsEndpoint) return { statusCode: 500, headers: corsHeaders, body: "Relay not configured" };

      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        const { ApiGatewayManagementApiClient, PostToConnectionCommand } =
          await import("@aws-sdk/client-apigatewaymanagementapi");
        const mgmtEndpoint = wsEndpoint.replace("wss://", "https://").replace("ws://", "http://");
        const mgmt = new ApiGatewayManagementApiClient({ endpoint: mgmtEndpoint });
        await mgmt.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify({ requestId, type: "asset", path: assetPath })),
        }));
      } catch {
        return { statusCode: 502, headers: corsHeaders, body: "Dev session disconnected" };
      }

      // Poll for response
      const { getRelayResponse, deleteRelayResponse } = await import("../relay/store.js");
      for (let i = 0; i < 50; i++) { // 50 × 100ms = 5s max
        const body = await getRelayResponse(requestId);
        if (body !== null) {
          deleteRelayResponse(requestId).catch(() => {});
          try {
            const asset = JSON.parse(body);
            return {
              statusCode: asset.status || 200,
              headers: {
                "Content-Type": asset.contentType || "application/javascript",
                ...corsHeaders,
              },
              body: asset.body || "",
            };
          } catch {
            return { statusCode: 502, headers: corsHeaders, body: "Invalid asset response" };
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return { statusCode: 504, headers: corsHeaders, body: "Asset request timed out" };
    }

    // Serve OAuth metadata at /dev/{sessionId}/.well-known/oauth-authorization-server
    // so Claude.ai can complete the OAuth flow when connecting to a dev session URL.
    if (path.match(/^\/dev\/[^/]+\/\.well-known\/oauth-authorization-server$/)) {
      const parts = path.split("/");
      const sessionId = parts[2];
      const devBaseUrl = `${serverUrlFromEvent(httpEvent)}/dev/${sessionId}`;
      return json(getOAuthMetadata(devBaseUrl), 200, origin);
    }

    // Handle OAuth endpoints under /dev/{sessionId}/*
    if (path.match(/^\/dev\/[^/]+\/(register|authorize|token|revoke)/) ) {
      // Strip /dev/{sessionId} prefix and re-route to the main OAuth handlers
      const parts = path.split("/");
      const sessionId = parts[2];
      const oauthPath = "/" + parts.slice(3).join("/");
      const devBaseUrl = `${serverUrlFromEvent(httpEvent)}/dev/${sessionId}`;

      // Rewrite the path and delegate to the same OAuth logic
      // by creating a modified event with the stripped path
      const modifiedEvent = {
        ...httpEvent,
        rawPath: oauthPath,
        requestContext: {
          ...httpEvent.requestContext,
          http: { ...httpEvent.requestContext.http },
        },
      };
      // Override serverUrlFromEvent for this request
      (modifiedEvent as any)._devBaseUrl = devBaseUrl;

      // Re-enter the handler with the modified path
      // For simplicity, handle the key endpoints inline:
      if (oauthPath === "/register" && method === "POST") {
        const body = safeParseBody(httpEvent.body, httpEvent.headers["content-type"]);
        if (!body) return json({ error: "Invalid request body" }, 400, origin);
        const result = await handleRegister(body, putOAuthItem);
        return json(result, 201, origin);
      }

      if (oauthPath === "/authorize" && method === "GET") {
        const params = httpEvent.queryStringParameters || {};
        const authorizeParams = {
          response_type: params.response_type || "",
          client_id: params.client_id || "",
          redirect_uri: params.redirect_uri || "",
          code_challenge: params.code_challenge || "",
          code_challenge_method: params.code_challenge_method || "",
          state: params.state || "",
          scope: params.scope,
        };
        const validation = await validateAuthorizeRequest(authorizeParams, getOAuthItem);
        if (!validation.valid) {
          return json({ error: validation.error }, 400, origin);
        }
        const authSessionId = await storeAuthorizeSession(authorizeParams, putOAuthItem);
        const loginUrl = new URL(`${betterAuthUrl()}/login`);
        loginUrl.searchParams.set("callback", `${devBaseUrl}/authorize/callback`);
        loginUrl.searchParams.set("session_id", authSessionId);
        return { statusCode: 302, headers: { Location: loginUrl.toString() }, body: "" };
      }

      if (oauthPath.startsWith("/authorize/callback")) {
        const params = httpEvent.queryStringParameters || {};
        const authSessionId = params.session_id;
        const userId = params.user_id;
        if (!authSessionId || !userId) {
          return json({ error: "Missing session_id or user_id" }, 400, origin);
        }
        const result = await issueAuthCode(userId, authSessionId, getOAuthItem, putOAuthItem, deleteOAuthItem);
        const redirect = new URL(result.redirectUri);
        redirect.searchParams.set("code", result.code);
        if (result.state) redirect.searchParams.set("state", result.state);
        return { statusCode: 302, headers: { Location: redirect.toString() }, body: "" };
      }

      if (oauthPath === "/token" && method === "POST") {
        const body = safeParseBody(httpEvent.body, httpEvent.headers["content-type"]);
        if (!body) return json({ error: "Invalid request body" }, 400, origin);
        const tokenResult = await handleTokenExchange(body, getOAuthItem, putOAuthItem, deleteOAuthItem);
        return json(tokenResult, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    }

    // Dev Relay MCP requests (POST /dev/{sessionId})
    log.info("Request", { method, path, hasAuth: !!httpEvent.headers.authorization });
    if (path.startsWith("/dev/") && method === "POST") {
      const sessionId = path.slice(5); // "/dev/abc123" → "abc123"
      if (!sessionId) return json({ error: "Missing sessionId" }, 400, origin);

      // Auth: same as MCP endpoint
      const authHeader = httpEvent.headers.authorization || httpEvent.headers.Authorization || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return json({ error: "Missing Authorization header" }, 401, origin);

      let userId: string;
      try {
        const auth = await mcpRequireAuthorized(token);
        userId = auth.userId;
      } catch {
        return json({ error: "Invalid or expired token" }, 401, origin);
      }

      // Look up the dev session and verify ownership
      const session = await getOAuthItem(`DEV_SESSION#${sessionId}`, "CONNECTION");
      if (!session) return json({ error: "Dev session not found" }, 404, origin);

      const sessionUserId = (session as any).userId as string;
      if (sessionUserId && sessionUserId !== userId) {
        log.warn("Dev session auth mismatch", { sessionId, sessionUserId, requestUserId: userId });
        return json({ error: "Not authorized for this dev session" }, 403, origin);
      }

      const connectionId = (session as any).connectionId as string;
      if (!connectionId) return json({ error: "Dev session has no connection" }, 500, origin);

      // Parse the MCP request
      const body = safeParseBody(httpEvent.body);
      if (!body) return json({ error: "Invalid request body" }, 400, origin);

      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Forward to CLI via WebSocket
      const wsEndpoint = devRelayUrl();
      if (!wsEndpoint) return json({ error: "Relay not configured" }, 500, origin);

      try {
        const { ApiGatewayManagementApiClient, PostToConnectionCommand } =
          await import("@aws-sdk/client-apigatewaymanagementapi");

        // Convert wss:// URL to https:// management endpoint
        const mgmtEndpoint = wsEndpoint
          .replace("wss://", "https://")
          .replace("ws://", "http://");

        const mgmt = new ApiGatewayManagementApiClient({ endpoint: mgmtEndpoint });
        await mgmt.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify({
            requestId,
            method: (body as any).method,
            params: (body as any).params,
            id: (body as any).id,
          })),
        }));
      } catch (err: any) {
        log.error("Relay PostToConnection failed", { sessionId, error: err.message });
        return json({ error: "Dev session disconnected" }, 502, origin);
      }

      // Poll DevRelayStore for the response
      const { getRelayResponse, deleteRelayResponse } = await import("../relay/store.js");
      const maxWait = 25; // 25 iterations × 200ms = 5 seconds max
      for (let i = 0; i < maxWait; i++) {
        const responseBody = await getRelayResponse(requestId);
        if (responseBody !== null) {
          deleteRelayResponse(requestId).catch(() => {});
          // Notifications return "null" — just acknowledge
          if (responseBody === "null") {
            return json({}, 200, origin);
          }
          const parsed = JSON.parse(responseBody);
          return json({
            jsonrpc: "2.0",
            id: (body as any).id ?? null,
            result: parsed,
          }, 200, origin);
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      return json({
        jsonrpc: "2.0",
        id: (body as any).id ?? null,
        error: { code: -32000, message: "Dev session timed out" },
      }, 504, origin);
    }

    // --- MCP Protocol (POST /) ---

    if (path === "/" && method === "POST") {
      // Authenticate via authz layer
      const authHeader = httpEvent.headers.authorization || httpEvent.headers.Authorization || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        audit({ action: "auth.failed", detail: "missing authorization header" });
        return json({ error: "Missing Authorization header" }, 401, origin);
      }

      let userId: string;
      try {
        const auth = await mcpRequireAuthorized(token);
        userId = auth.userId;
      } catch {
        audit({ action: "auth.failed", detail: "invalid or expired access token" });
        return json({ error: "Invalid or expired token" }, 401, origin);
      }

      // Rate limit per user
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        audit({ action: "auth.failed", userId, detail: "rate limit exceeded" });
        return json({
          jsonrpc: "2.0",
          id: (safeParseBody(httpEvent.body) as any)?.id ?? null,
          error: {
            code: -32029,
            message: "Rate limit exceeded (60 requests/minute). Wait a moment before retrying. This can happen when loading a session with many tool results.",
          },
        }, 429, origin);
      }

      const body = safeParseBody(httpEvent.body);
      if (!body) return json({ error: "Invalid request body" }, 400, origin);
      const request = body as JsonRpcRequest;

      const { response } = await handleMcpRequest(
        request,
        userId,
        getAllRegistryItems,
        getUserKitDbs,
        invokeKitLambda
      );

      return json(response, 200, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  } catch (err: any) {
    log.error("Router error", { error: err.message });
    return json({ error: "Internal server error" }, 500, origin);
  } finally {
    await flushLogs();
  }
}

function safeParseBody(body: string | undefined, contentType?: string): any | null {
  if (!body) return null;

  // Handle application/x-www-form-urlencoded (OAuth standard)
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    const obj: Record<string, string> = {};
    for (const [key, value] of params) {
      obj[key] = value;
    }
    return obj;
  }

  // Try JSON first, fall back to form-urlencoded
  try {
    return JSON.parse(body);
  } catch {
    try {
      const params = new URLSearchParams(body);
      if (params.has("grant_type") || params.has("client_id") || params.has("code")) {
        const obj: Record<string, string> = {};
        for (const [key, value] of params) {
          obj[key] = value;
        }
        return obj;
      }
    } catch {
      // not form data either
    }
    return null;
  }
}
