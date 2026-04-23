import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getOAuthMetadata } from "./oauth/metadata";
import { handleRegister } from "./oauth/register";
import { validateAuthorizeRequest, issueAuthCode } from "./oauth/authorize";
import { handleTokenExchange } from "./oauth/token";
import { verifyAccessToken } from "./oauth/helpers";
import { handleMcpRequest } from "./mcp-protocol";
import { getAllRegistryItems } from "../framework/dynamo";
import {
  getOAuthItem,
  putOAuthItem,
  deleteOAuthItem,
} from "./oauth-store";
import type { JsonRpcRequest } from "../framework/types";

const lambda = new LambdaClient({});

const serverUrl = () => process.env.MCP_SERVER_URL || "https://mcp.kitstack.co";

function json(body: unknown, status = 200): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // CORS preflight
  if (method === "OPTIONS") {
    return json({}, 204);
  }

  try {
    // --- OAuth Endpoints ---

    if (path === "/.well-known/oauth-authorization-server") {
      return json(getOAuthMetadata(serverUrl()));
    }

    if (path === "/register" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const result = await handleRegister(body, putOAuthItem);
      return json(result, 201);
    }

    if (path === "/authorize" && method === "GET") {
      const params = event.queryStringParameters || {};
      const validation = validateAuthorizeRequest({
        response_type: params.response_type || "",
        client_id: params.client_id || "",
        redirect_uri: params.redirect_uri || "",
        code_challenge: params.code_challenge || "",
        code_challenge_method: params.code_challenge_method || "S256",
        state: params.state,
      });

      if (!validation.valid) {
        return json({ error: validation.error }, 400);
      }

      // For now, redirect to BetterAuth login page with callback params
      const loginUrl = new URL(`${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/login`);
      loginUrl.searchParams.set("callback", `${serverUrl()}/authorize/callback`);
      loginUrl.searchParams.set("mcp_params", JSON.stringify(params));

      return {
        statusCode: 302,
        headers: { Location: loginUrl.toString() },
        body: "",
      };
    }

    if (path === "/authorize/callback" && method === "GET") {
      const params = event.queryStringParameters || {};
      const userId = params.user_id;
      const mcpParams = JSON.parse(params.mcp_params || "{}");

      if (!userId) {
        return json({ error: "Authentication failed" }, 401);
      }

      const code = await issueAuthCode(userId, mcpParams, putOAuthItem);
      const redirectUrl = new URL(mcpParams.redirect_uri);
      redirectUrl.searchParams.set("code", code);
      if (mcpParams.state) redirectUrl.searchParams.set("state", mcpParams.state);

      return {
        statusCode: 302,
        headers: { Location: redirectUrl.toString() },
        body: "",
      };
    }

    if (path === "/token" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const result = await handleTokenExchange(
        body,
        getOAuthItem,
        putOAuthItem,
        deleteOAuthItem
      );
      return json(result);
    }

    // --- Connection check (called by the marketing site) ---

    if (path === "/connected" && method === "GET") {
      const userId = event.queryStringParameters?.userId;
      if (!userId) {
        return json({ connected: false, reason: "missing_userId" }, 400);
      }

      // Check if this user has any refresh tokens in OAuthStore
      // Refresh tokens are stored as REFRESH#{token} → { userId, clientId }
      // We can't query by userId directly (it's in the data JSON), so we scan
      // with a filter. At low scale this is fine.
      const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
      const { unmarshall } = await import("@aws-sdk/util-dynamodb");
      const dynamo = new DynamoDBClient({});
      const oauthTable = process.env.OAUTH_STORE_TABLE;

      if (!oauthTable) {
        return json({ connected: false, reason: "server_config_error" }, 500);
      }

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

      const hasToken = (scan.Items || []).some((item) => {
        const parsed = unmarshall(item);
        try {
          const data = JSON.parse(parsed.data);
          return data.userId === userId;
        } catch {
          return false;
        }
      });

      return json({ connected: hasToken });
    }

    // --- MCP Protocol (POST /) ---

    if (path === "/" && method === "POST") {
      // Authenticate
      const authHeader = event.headers.authorization || event.headers.Authorization || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        return json({ error: "Missing Authorization header" }, 401);
      }

      let userId: string;
      try {
        const auth = await verifyAccessToken(token);
        userId = auth.userId;
      } catch {
        return json({ error: "Invalid or expired token" }, 401);
      }

      const request = JSON.parse(event.body || "{}") as JsonRpcRequest;

      const response = await handleMcpRequest(
        request,
        userId,
        getAllRegistryItems,
        invokeKitLambda
      );

      return json(response);
    }

    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    console.error("Router error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
}
