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
import { getAllRegistryItems, getUserKitDbs } from "../framework/dynamo";
import { mcpRequireAuthorized } from "../framework/authz";
import { audit } from "../framework/audit";
import { log, flushLogs } from "../framework/logger";
import {
  getOAuthItem,
  putOAuthItem,
  deleteOAuthItem,
} from "./oauth-store";
import { Resource } from "sst";
import type { JsonRpcRequest } from "../framework/types";

const lambda = new LambdaClient({});
const dynamo = new DynamoDBClient({});

function serverUrlFromEvent(event: APIGatewayProxyEventV2): string {
  return `https://${event.requestContext.domainName}`;
}

const ALLOWED_ORIGINS = (Resource.McpAllowedOrigins.value || "https://kitstack.co,https://www.kitstack.co")
  .split(",")
  .map((o: string) => o.trim());

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
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute per user

async function checkRateLimit(userId: string): Promise<boolean> {
  const oauthTable = Resource.OAuthStore.name;
  if (!oauthTable) return true; // fail-open if table not configured

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
  } catch {
    return true; // fail-open on DynamoDB errors
  }
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const origin = event.headers.origin;

  // CORS preflight
  if (method === "OPTIONS") {
    return json({}, 204, origin);
  }

  try {
    // --- OAuth Endpoints ---

    if (path === "/.well-known/oauth-authorization-server") {
      return json(getOAuthMetadata(serverUrlFromEvent(event)), 200, origin);
    }

    if (path === "/register" && method === "POST") {
      const body = safeParseBody(event.body, event.headers["content-type"]);
      if (!body) return json({ error: "Invalid request body" }, 400, origin);
      const result = await handleRegister(body, putOAuthItem);
      return json(result, 201, origin);
    }

    if (path === "/authorize" && method === "GET") {
      const params = event.queryStringParameters || {};
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

      const loginUrl = new URL(`${Resource.BetterAuthUrl.value || "http://localhost:3000"}/login`);
      loginUrl.searchParams.set("callback", `${serverUrlFromEvent(event)}/authorize/callback`);
      loginUrl.searchParams.set("session_id", sessionId);

      return {
        statusCode: 302,
        headers: { Location: loginUrl.toString() },
        body: "",
      };
    }

    if (path === "/authorize/callback" && method === "GET") {
      const params = event.queryStringParameters || {};
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
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString()
        : event.body;
      const body = safeParseBody(rawBody, event.headers["content-type"]);
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
      const body = safeParseBody(event.body);
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
          const oauthTable = Resource.OAuthStore.name;
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
      const internalKey = Resource.McpInternalApiKey.value;
      if (internalKey) {
        const providedKey =
          event.headers["x-internal-api-key"] || event.queryStringParameters?.api_key;
        if (providedKey !== internalKey) {
          return json({ error: "Unauthorized" }, 401, origin);
        }
      }

      const userId = event.queryStringParameters?.userId;
      if (!userId) {
        return json({ connected: false, reason: "missing_userId" }, 400, origin);
      }

      const oauthTable = Resource.OAuthStore.name;
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

    // --- MCP Protocol (POST /) ---

    if (path === "/" && method === "POST") {
      // Authenticate via authz layer
      const authHeader = event.headers.authorization || event.headers.Authorization || "";
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
        return json({ error: "Rate limit exceeded. Try again later." }, 429, origin);
      }

      const body = safeParseBody(event.body);
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
